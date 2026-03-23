package service

import (
	"context"
	"fmt"
	"time"

	"github.com/deepampatel/planfast/internal/model"
	"github.com/deepampatel/planfast/internal/repository"
)

type PlanService struct {
	planRepo        *repository.PlanRepository
	participantRepo *repository.ParticipantRepository
	availRepo       *repository.AvailabilityRepository
	auditRepo       *repository.AuditRepository
	slugGen         *SlugGenerator
}

func NewPlanService(
	planRepo *repository.PlanRepository,
	participantRepo *repository.ParticipantRepository,
	availRepo *repository.AvailabilityRepository,
	auditRepo *repository.AuditRepository,
) *PlanService {
	return &PlanService{
		planRepo:        planRepo,
		participantRepo: participantRepo,
		availRepo:       availRepo,
		auditRepo:       auditRepo,
		slugGen:         NewSlugGenerator(),
	}
}

func (s *PlanService) Create(ctx context.Context, input model.CreatePlanInput) (*model.PlanWithTokens, error) {
	slug, err := s.slugGen.Generate(ctx, s.planRepo)
	if err != nil {
		return nil, fmt.Errorf("generating slug: %w", err)
	}

	hostToken := GenerateToken()
	expiresAt := time.Now().Add(14 * 24 * time.Hour).UTC().Format(time.RFC3339)

	var customSlug *string
	if input.CustomSlug != "" {
		exists, err := s.planRepo.SlugExists(ctx, input.CustomSlug)
		if err != nil {
			return nil, fmt.Errorf("checking custom slug: %w", err)
		}
		if exists {
			return nil, fmt.Errorf("custom slug %q is already taken", input.CustomSlug)
		}
		customSlug = &input.CustomSlug
	}

	if input.DurationMinutes == 0 {
		input.DurationMinutes = 60
	}
	if input.Granularity == "" {
		input.Granularity = "time"
	}
	if input.Timezone == "" {
		input.Timezone = "UTC"
	}

	var customOptionsStr *string
	if len(input.CustomOptions) > 0 {
		s := string(input.CustomOptions)
		customOptionsStr = &s
	}

	plan, err := s.planRepo.Create(ctx, repository.CreatePlanParams{
		Slug:            slug,
		CustomSlug:      customSlug,
		Title:           input.Title,
		Location:        input.Location,
		DateRangeStart:  input.DateRangeStart,
		DateRangeEnd:    input.DateRangeEnd,
		DurationMinutes: input.DurationMinutes,
		Granularity:     input.Granularity,
		HostToken:       hostToken,
		Status:          "active",
		Timezone:        input.Timezone,
		CustomOptions:   customOptionsStr,
		ExpiresAt:       expiresAt,
	})
	if err != nil {
		return nil, fmt.Errorf("creating plan: %w", err)
	}

	// Create host as first participant
	editToken := GenerateToken()
	hostName := input.HostName
	if hostName == "" {
		hostName = "Host"
	}
	participant, err := s.participantRepo.Create(ctx, plan.ID, hostName, editToken, input.Timezone, "")
	if err != nil {
		return nil, fmt.Errorf("creating host participant: %w", err)
	}

	plan.Participants = []model.Participant{*participant}
	plan.ParticipantCount = 1

	// Audit log
	s.auditRepo.Log(ctx, plan.ID, hostName, "plan_created", plan.Title)

	return &model.PlanWithTokens{
		Plan:      *plan,
		HostToken: hostToken,
		EditToken: editToken,
	}, nil
}

func (s *PlanService) GetBySlug(ctx context.Context, slug string, editToken string) (*model.Plan, error) {
	plan, err := s.planRepo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}

	participants, err := s.participantRepo.GetByPlanID(ctx, plan.ID)
	if err != nil {
		return nil, fmt.Errorf("fetching participants: %w", err)
	}

	// Load availability for each participant
	for i := range participants {
		avail, err := s.availRepo.GetByParticipant(ctx, participants[i].ID)
		if err != nil {
			return nil, fmt.Errorf("fetching availability: %w", err)
		}
		participants[i].Availability = avail
	}

	plan.Participants = participants
	plan.ParticipantCount = len(participants)

	// Identify which participant matches the edit token
	if editToken != "" {
		participant, err := s.participantRepo.GetByEditToken(ctx, editToken)
		if err == nil && participant.PlanID == plan.ID {
			plan.MyParticipantID = &participant.ID
		}
	}

	return plan, nil
}

func (s *PlanService) Lock(ctx context.Context, slug string, hostToken string) error {
	plan, err := s.planRepo.GetBySlug(ctx, slug)
	if err != nil {
		return fmt.Errorf("plan not found: %w", err)
	}

	storedToken, err := s.planRepo.GetHostToken(ctx, plan.ID)
	if err != nil {
		return fmt.Errorf("fetching host token: %w", err)
	}

	if storedToken != hostToken {
		return fmt.Errorf("unauthorized: invalid host token")
	}

	if err := s.planRepo.Lock(ctx, plan.ID); err != nil {
		return err
	}

	s.auditRepo.Log(ctx, plan.ID, "", "plan_locked", "")
	return nil
}

func (s *PlanService) UpdateTitle(ctx context.Context, slug string, hostToken string, title string) error {
	plan, err := s.planRepo.GetBySlug(ctx, slug)
	if err != nil {
		return fmt.Errorf("plan not found: %w", err)
	}

	storedToken, err := s.planRepo.GetHostToken(ctx, plan.ID)
	if err != nil {
		return fmt.Errorf("fetching host token: %w", err)
	}

	if storedToken != hostToken {
		return fmt.Errorf("unauthorized: invalid host token")
	}

	if title == "" {
		return fmt.Errorf("title cannot be empty")
	}

	if err := s.planRepo.UpdateTitle(ctx, plan.ID, title); err != nil {
		return err
	}

	s.auditRepo.Log(ctx, plan.ID, "", "plan_renamed", title)
	return nil
}
