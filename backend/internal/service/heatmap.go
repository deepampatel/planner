package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/deepampatel/planfast/internal/model"
	"github.com/deepampatel/planfast/internal/repository"
)

type HeatmapService struct {
	availRepo       *repository.AvailabilityRepository
	planRepo        *repository.PlanRepository
	participantRepo *repository.ParticipantRepository
}

func NewHeatmapService(
	availRepo *repository.AvailabilityRepository,
	planRepo *repository.PlanRepository,
	participantRepo *repository.ParticipantRepository,
) *HeatmapService {
	return &HeatmapService{
		availRepo:       availRepo,
		planRepo:        planRepo,
		participantRepo: participantRepo,
	}
}

type slotKey struct {
	Start string
	End   string
}

func (s *HeatmapService) Compute(ctx context.Context, slug string, filterIDs []int64) (*model.HeatmapResponse, error) {
	plan, err := s.planRepo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("plan not found: %w", err)
	}

	participantCount, err := s.participantRepo.CountByPlanID(ctx, plan.ID)
	if err != nil {
		return nil, fmt.Errorf("counting participants: %w", err)
	}

	if participantCount == 0 {
		return &model.HeatmapResponse{Cells: []model.HeatmapCell{}}, nil
	}

	availability, err := s.availRepo.GetByPlanID(ctx, plan.ID)
	if err != nil {
		return nil, fmt.Errorf("fetching availability: %w", err)
	}

	// Filter by participant IDs if provided
	if len(filterIDs) > 0 {
		filterSet := make(map[int64]bool)
		for _, id := range filterIDs {
			filterSet[id] = true
		}
		var filtered []repository.AvailabilityWithParticipant
		for _, a := range availability {
			if filterSet[a.ParticipantID] {
				filtered = append(filtered, a)
			}
		}
		availability = filtered
		participantCount = len(filterIDs)
	}

	slotMap := make(map[string]*slotAgg)

	for _, a := range availability {
		key := a.SlotStart + "|" + a.SlotEnd
		if _, ok := slotMap[key]; !ok {
			slotMap[key] = &slotAgg{}
		}
		switch a.Status {
		case "free":
			slotMap[key].freeCount++
			slotMap[key].freeNames = append(slotMap[key].freeNames, a.DisplayName)
		case "maybe":
			slotMap[key].maybeCount++
			slotMap[key].maybeNames = append(slotMap[key].maybeNames, a.DisplayName)
		}
	}

	// Generate all slots for the plan range
	slots := generateSlots(plan)

	cells := make([]model.HeatmapCell, 0, len(slots))
	for _, slot := range slots {
		key := slot.Start + "|" + slot.End
		cell := model.HeatmapCell{
			SlotStart:         slot.Start,
			SlotEnd:           slot.End,
			TotalParticipants: participantCount,
		}

		if agg, ok := slotMap[key]; ok {
			cell.FreeCount = agg.freeCount
			cell.MaybeCount = agg.maybeCount
		}

		// Score: binary — free counts, everything else doesn't
		cell.Score = float64(cell.FreeCount) / float64(participantCount)
		cells = append(cells, cell)
	}

	// Rank candidate windows; best slot is the top one
	topSlots := findTopSlots(plan, cells, slotMap, 3)
	var bestSlot *model.BestSlot
	if len(topSlots) > 0 {
		bestSlot = &topSlots[0]
	}

	return &model.HeatmapResponse{
		Cells:    cells,
		BestSlot: bestSlot,
		TopSlots: topSlots,
	}, nil
}

// findTopSlots ranks candidate windows and returns up to n non-overlapping
// results, best first. For options mode each option is its own candidate.
func findTopSlots(plan *model.Plan, cells []model.HeatmapCell, slotMap map[string]*slotAgg, n int) []model.BestSlot {
	if len(cells) == 0 {
		return nil
	}

	// Options mode: rank options by score
	if plan.Granularity == "options" {
		type scored struct {
			idx   int
			score float64
		}
		var ranked []scored
		for i, cell := range cells {
			if cell.Score > 0 {
				ranked = append(ranked, scored{i, cell.Score})
			}
		}
		sort.SliceStable(ranked, func(a, b int) bool { return ranked[a].score > ranked[b].score })
		if len(ranked) > n {
			ranked = ranked[:n]
		}
		out := make([]model.BestSlot, 0, len(ranked))
		for _, s := range ranked {
			cell := cells[s.idx]
			key := cell.SlotStart + "|" + cell.SlotEnd
			var freeNames, maybeNames []string
			if agg, ok := slotMap[key]; ok {
				freeNames = agg.freeNames
				maybeNames = agg.maybeNames
			}
			out = append(out, model.BestSlot{
				Start:             cell.SlotStart,
				End:               cell.SlotEnd,
				Score:             s.score,
				FreeParticipants:  freeNames,
				MaybeParticipants: maybeNames,
			})
		}
		return out
	}

	slotDuration := 30 // minutes for time granularity
	if plan.Granularity == "day" {
		slotDuration = 240 // 4-hour blocks
	}

	windowSize := plan.DurationMinutes / slotDuration
	if windowSize < 1 {
		windowSize = 1
	}
	if windowSize > len(cells) {
		windowSize = len(cells)
	}

	// Score every window that doesn't cross a day boundary
	type window struct {
		start int
		score float64
	}
	var windows []window
	for i := 0; i <= len(cells)-windowSize; i++ {
		if cells[i].SlotStart[:10] != cells[i+windowSize-1].SlotStart[:10] {
			continue // window spans two dates
		}
		windowScore := 0.0
		for j := i; j < i+windowSize; j++ {
			windowScore += cells[j].Score
		}
		avgScore := windowScore / float64(windowSize)
		if avgScore > 0 {
			windows = append(windows, window{i, avgScore})
		}
	}

	sort.SliceStable(windows, func(a, b int) bool { return windows[a].score > windows[b].score })

	// Greedily pick non-overlapping windows, best first
	out := make([]model.BestSlot, 0, n)
	taken := make([]bool, len(cells))
	for _, w := range windows {
		if len(out) >= n {
			break
		}
		overlaps := false
		for j := w.start; j < w.start+windowSize; j++ {
			if taken[j] {
				overlaps = true
				break
			}
		}
		if overlaps {
			continue
		}
		for j := w.start; j < w.start+windowSize; j++ {
			taken[j] = true
		}

		freeSet := make(map[string]bool)
		maybeSet := make(map[string]bool)
		for j := w.start; j < w.start+windowSize; j++ {
			key := cells[j].SlotStart + "|" + cells[j].SlotEnd
			if agg, ok := slotMap[key]; ok {
				for _, name := range agg.freeNames {
					freeSet[name] = true
				}
				for _, name := range agg.maybeNames {
					maybeSet[name] = true
				}
			}
		}
		freeNames := make([]string, 0, len(freeSet))
		for name := range freeSet {
			freeNames = append(freeNames, name)
		}
		sort.Strings(freeNames)
		maybeNames := make([]string, 0, len(maybeSet))
		for name := range maybeSet {
			if !freeSet[name] { // Don't double-count
				maybeNames = append(maybeNames, name)
			}
		}
		sort.Strings(maybeNames)

		out = append(out, model.BestSlot{
			Start:             cells[w.start].SlotStart,
			End:               cells[w.start+windowSize-1].SlotEnd,
			Score:             w.score,
			FreeParticipants:  freeNames,
			MaybeParticipants: maybeNames,
		})
	}

	return out
}

type slot struct {
	Start string
	End   string
}

func generateSlots(plan *model.Plan) []slot {
	// Custom options mode — slots are the option labels
	if plan.Granularity == "options" && len(plan.CustomOptions) > 0 {
		var options []model.CustomOption
		if err := json.Unmarshal(plan.CustomOptions, &options); err == nil {
			var slots []slot
			for _, opt := range options {
				slots = append(slots, slot{Start: opt.Label, End: opt.Label})
			}
			return slots
		}
	}

	start, _ := time.Parse("2006-01-02", plan.DateRangeStart)
	end, _ := time.Parse("2006-01-02", plan.DateRangeEnd)

	// Load the plan's timezone — slots at "8 AM" mean 8 AM in this timezone.
	// time.Date(y, m, d, h, 0, 0, 0, loc).UTC() gives the correct UTC equivalent.
	loc, err := time.LoadLocation(plan.Timezone)
	if err != nil {
		log.Warn().Str("timezone", plan.Timezone).Int64("planId", plan.ID).
			Msg("unknown timezone, falling back to UTC — heatmap slots may not match stored availability")
		loc = time.UTC // fallback
	}

	var slots []slot

	if plan.Granularity == "day" {
		// AM (08:00-12:00), PM (12:00-17:00), Eve (17:00-22:00) in plan timezone
		periods := [][2]int{{8, 12}, {12, 17}, {17, 22}}
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			for _, p := range periods {
				slotStart := time.Date(d.Year(), d.Month(), d.Day(), p[0], 0, 0, 0, loc).UTC()
				slotEnd := time.Date(d.Year(), d.Month(), d.Day(), p[1], 0, 0, 0, loc).UTC()
				slots = append(slots, slot{
					Start: slotStart.Format(time.RFC3339),
					End:   slotEnd.Format(time.RFC3339),
				})
			}
		}
	} else {
		// 30-minute slots for full 24 hours in plan timezone
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			for hour := 0; hour < 24; hour++ {
				for _, min := range []int{0, 30} {
					slotStart := time.Date(d.Year(), d.Month(), d.Day(), hour, min, 0, 0, loc).UTC()
					slotEnd := slotStart.Add(30 * time.Minute)
					slots = append(slots, slot{
						Start: slotStart.Format(time.RFC3339),
						End:   slotEnd.Format(time.RFC3339),
					})
				}
			}
		}
	}

	return slots
}

type slotAgg struct {
	freeCount  int
	maybeCount int
	freeNames  []string
	maybeNames []string
}
