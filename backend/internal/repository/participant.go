package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/deepampatel/planfast/internal/model"
)

type ParticipantRepository struct {
	db *sql.DB
}

func NewParticipantRepository(db *sql.DB) *ParticipantRepository {
	return &ParticipantRepository{db: db}
}

func (r *ParticipantRepository) Create(ctx context.Context, planID int64, displayName, editToken, timezone, email string) (*model.Participant, error) {
	query := `
		INSERT INTO participants (plan_id, display_name, edit_token, timezone, email)
		VALUES (?, ?, ?, ?, ?)
		RETURNING id, plan_id, display_name, email, timezone, has_responded, created_at`

	var p model.Participant
	var hasResp int
	err := r.db.QueryRowContext(ctx, query, planID, displayName, editToken, timezone, email).Scan(
		&p.ID, &p.PlanID, &p.DisplayName, &p.Email, &p.Timezone, &hasResp, &p.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting participant: %w", err)
	}
	p.HasResponded = hasResp == 1
	p.Availability = []model.AvailabilitySlot{}
	return &p, nil
}

func (r *ParticipantRepository) GetByPlanID(ctx context.Context, planID int64) ([]model.Participant, error) {
	query := `SELECT id, plan_id, display_name, email, timezone, has_responded, created_at FROM participants WHERE plan_id = ? ORDER BY created_at`
	rows, err := r.db.QueryContext(ctx, query, planID)
	if err != nil {
		return nil, fmt.Errorf("querying participants: %w", err)
	}
	defer rows.Close()

	var participants []model.Participant
	for rows.Next() {
		var p model.Participant
		var hasResp int
		if err := rows.Scan(&p.ID, &p.PlanID, &p.DisplayName, &p.Email, &p.Timezone, &hasResp, &p.CreatedAt); err != nil {
			return nil, err
		}
		p.HasResponded = hasResp == 1
		p.Availability = []model.AvailabilitySlot{}
		participants = append(participants, p)
	}

	if participants == nil {
		participants = []model.Participant{}
	}
	return participants, rows.Err()
}

func (r *ParticipantRepository) GetByEditToken(ctx context.Context, editToken string) (*model.Participant, error) {
	query := `SELECT id, plan_id, display_name, email, timezone, has_responded, created_at FROM participants WHERE edit_token = ?`
	var p model.Participant
	var hasResp int
	err := r.db.QueryRowContext(ctx, query, editToken).Scan(
		&p.ID, &p.PlanID, &p.DisplayName, &p.Email, &p.Timezone, &hasResp, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.HasResponded = hasResp == 1
	p.Availability = []model.AvailabilitySlot{}
	return &p, nil
}

func (r *ParticipantRepository) MarkResponded(ctx context.Context, participantID int64) error {
	_, err := r.db.ExecContext(ctx, "UPDATE participants SET has_responded = 1 WHERE id = ? AND has_responded = 0", participantID)
	return err
}

func (r *ParticipantRepository) CountByPlanID(ctx context.Context, planID int64) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM participants WHERE plan_id = ?", planID).Scan(&count)
	return count, err
}

// GetByUserIDAndPlanID finds a participant by their linked user account.
// Returns nil, nil if no participant is linked to this user in this plan.
func (r *ParticipantRepository) GetByUserIDAndPlanID(ctx context.Context, userID, planID int64) (*model.Participant, error) {
	query := `SELECT id, plan_id, display_name, email, timezone, has_responded, created_at FROM participants WHERE user_id = ? AND plan_id = ?`
	var p model.Participant
	var hasResp int
	err := r.db.QueryRowContext(ctx, query, userID, planID).Scan(
		&p.ID, &p.PlanID, &p.DisplayName, &p.Email, &p.Timezone, &hasResp, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.HasResponded = hasResp == 1
	p.Availability = []model.AvailabilitySlot{}
	return &p, nil
}

// GetEditTokenByID returns the edit token for a participant. Used for tap-to-recover.
func (r *ParticipantRepository) GetEditTokenByID(ctx context.Context, participantID, planID int64) (string, error) {
	var token string
	err := r.db.QueryRowContext(ctx, "SELECT edit_token FROM participants WHERE id = ? AND plan_id = ?", participantID, planID).Scan(&token)
	return token, err
}

// LinkUserID associates a participant with a user account for identity recovery.
func (r *ParticipantRepository) LinkUserID(ctx context.Context, participantID, userID int64) error {
	_, err := r.db.ExecContext(ctx, "UPDATE participants SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = 0)", userID, participantID)
	return err
}
