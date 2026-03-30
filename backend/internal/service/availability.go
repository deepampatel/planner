package service

import (
	"context"
	"fmt"

	"github.com/deepampatel/planfast/internal/model"
	"github.com/deepampatel/planfast/internal/repository"
)

type AvailabilityService struct {
	availRepo       *repository.AvailabilityRepository
	participantRepo *repository.ParticipantRepository
	planRepo        *repository.PlanRepository
	auditRepo       *repository.AuditRepository
}

func NewAvailabilityService(
	availRepo *repository.AvailabilityRepository,
	participantRepo *repository.ParticipantRepository,
	planRepo *repository.PlanRepository,
	auditRepo *repository.AuditRepository,
) *AvailabilityService {
	return &AvailabilityService{
		availRepo:       availRepo,
		participantRepo: participantRepo,
		planRepo:        planRepo,
		auditRepo:       auditRepo,
	}
}

// ParticipantRepo exposes the participant repository for recovery handler.
func (s *AvailabilityService) ParticipantRepo() *repository.ParticipantRepository {
	return s.participantRepo
}

func (s *AvailabilityService) Update(ctx context.Context, editToken string, updates []model.AvailabilityUpdate) error {
	participant, err := s.participantRepo.GetByEditToken(ctx, editToken)
	if err != nil {
		return fmt.Errorf("invalid edit token: %w", err)
	}

	// Check plan is still active
	plan, err := s.planRepo.GetByID(ctx, participant.PlanID)
	if err != nil {
		return fmt.Errorf("plan not found: %w", err)
	}
	if plan.Status != model.PlanStatusActive {
		return fmt.Errorf("plan is %s, cannot update availability", plan.Status)
	}

	if err := s.availRepo.BatchUpsert(ctx, participant.ID, updates); err != nil {
		return fmt.Errorf("updating availability: %w", err)
	}

	// Mark participant as having responded
	if err := s.participantRepo.MarkResponded(ctx, participant.ID); err != nil {
		return fmt.Errorf("marking responded: %w", err)
	}

	// Touch plan updated_at so polling clients pick up changes
	if err := s.planRepo.TouchUpdatedAt(ctx, participant.PlanID); err != nil {
		return fmt.Errorf("touching plan updated_at: %w", err)
	}

	// Audit log
	s.auditRepo.Log(ctx, participant.PlanID, participant.DisplayName, "availability_updated", fmt.Sprintf("%d slots", len(updates)))

	return nil
}

func (s *AvailabilityService) Join(ctx context.Context, slug string, input model.JoinPlanInput, userID int64) (*model.JoinPlanResult, error) {
	plan, err := s.planRepo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("plan not found: %w", err)
	}

	if plan.Status != "active" {
		return nil, fmt.Errorf("plan is %s", plan.Status)
	}

	editToken := GenerateToken()
	timezone := input.Timezone
	if timezone == "" {
		timezone = "UTC"
	}

	participant, err := s.participantRepo.Create(ctx, plan.ID, input.DisplayName, editToken, timezone, input.Email)
	if err != nil {
		return nil, fmt.Errorf("creating participant: %w", err)
	}

	// Link to authenticated user if signed in — enables identity recovery
	if userID > 0 {
		s.participantRepo.LinkUserID(ctx, participant.ID, userID)
	}

	// Touch plan updated_at
	s.planRepo.TouchUpdatedAt(ctx, plan.ID)

	// Audit log
	s.auditRepo.Log(ctx, plan.ID, input.DisplayName, "participant_joined", "")

	return &model.JoinPlanResult{
		Participant: *participant,
		EditToken:   editToken,
	}, nil
}
