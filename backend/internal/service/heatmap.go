package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

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

	// Find best slot
	bestSlot := findBestSlot(plan, cells, slotMap)

	return &model.HeatmapResponse{
		Cells:    cells,
		BestSlot: bestSlot,
	}, nil
}

func findBestSlot(plan *model.Plan, cells []model.HeatmapCell, slotMap map[string]*slotAgg) *model.BestSlot {
	if len(cells) == 0 {
		return nil
	}

	// Options mode: find single highest-scoring option
	if plan.Granularity == "options" {
		bestIdx := -1
		bestScore := 0.0
		for i, cell := range cells {
			if cell.Score > bestScore {
				bestScore = cell.Score
				bestIdx = i
			}
		}
		if bestIdx < 0 || bestScore <= 0 {
			return nil
		}
		key := cells[bestIdx].SlotStart + "|" + cells[bestIdx].SlotEnd
		var freeNames, maybeNames []string
		if agg, ok := slotMap[key]; ok {
			freeNames = agg.freeNames
			maybeNames = agg.maybeNames
		}
		return &model.BestSlot{
			Start:             cells[bestIdx].SlotStart,
			End:               cells[bestIdx].SlotEnd,
			Score:             bestScore,
			FreeParticipants:  freeNames,
			MaybeParticipants: maybeNames,
		}
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

	bestScore := -1.0
	bestStart := 0

	for i := 0; i <= len(cells)-windowSize; i++ {
		windowScore := 0.0
		for j := i; j < i+windowSize; j++ {
			windowScore += cells[j].Score
		}
		avgScore := windowScore / float64(windowSize)

		if avgScore > bestScore {
			bestScore = avgScore
			bestStart = i
		}
	}

	if bestScore <= 0 {
		return nil
	}

	// Collect participant names for the best window
	freeSet := make(map[string]bool)
	maybeSet := make(map[string]bool)
	for j := bestStart; j < bestStart+windowSize; j++ {
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
	maybeNames := make([]string, 0, len(maybeSet))
	for name := range maybeSet {
		if !freeSet[name] { // Don't double-count
			maybeNames = append(maybeNames, name)
		}
	}

	return &model.BestSlot{
		Start:             cells[bestStart].SlotStart,
		End:               cells[bestStart+windowSize-1].SlotEnd,
		Score:             bestScore,
		FreeParticipants:  freeNames,
		MaybeParticipants: maybeNames,
	}
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
