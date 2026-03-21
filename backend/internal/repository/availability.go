package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/deepampatel/planfast/internal/model"
)

type AvailabilityRepository struct {
	db *sql.DB
}

func NewAvailabilityRepository(db *sql.DB) *AvailabilityRepository {
	return &AvailabilityRepository{db: db}
}

func (r *AvailabilityRepository) Upsert(ctx context.Context, participantID int64, slot model.AvailabilitySlot) error {
	query := `
		INSERT INTO availability (participant_id, slot_start, slot_end, status)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(participant_id, slot_start, slot_end)
		DO UPDATE SET status = excluded.status`

	_, err := r.db.ExecContext(ctx, query, participantID, slot.SlotStart, slot.SlotEnd, slot.Status)
	return err
}

func (r *AvailabilityRepository) Delete(ctx context.Context, participantID int64, slotStart, slotEnd string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM availability WHERE participant_id = ? AND slot_start = ? AND slot_end = ?",
		participantID, slotStart, slotEnd,
	)
	return err
}

func (r *AvailabilityRepository) GetByParticipant(ctx context.Context, participantID int64) ([]model.AvailabilitySlot, error) {
	query := `SELECT slot_start, slot_end, status FROM availability WHERE participant_id = ? ORDER BY slot_start`
	rows, err := r.db.QueryContext(ctx, query, participantID)
	if err != nil {
		return nil, fmt.Errorf("querying availability: %w", err)
	}
	defer rows.Close()

	var slots []model.AvailabilitySlot
	for rows.Next() {
		var s model.AvailabilitySlot
		if err := rows.Scan(&s.SlotStart, &s.SlotEnd, &s.Status); err != nil {
			return nil, err
		}
		slots = append(slots, s)
	}

	if slots == nil {
		slots = []model.AvailabilitySlot{}
	}
	return slots, rows.Err()
}

type AvailabilityWithParticipant struct {
	ParticipantID   int64
	DisplayName     string
	SlotStart       string
	SlotEnd         string
	Status          string
}

func (r *AvailabilityRepository) GetByPlanID(ctx context.Context, planID int64) ([]AvailabilityWithParticipant, error) {
	query := `
		SELECT a.participant_id, p.display_name, a.slot_start, a.slot_end, a.status
		FROM availability a
		JOIN participants p ON a.participant_id = p.id
		WHERE p.plan_id = ?
		ORDER BY a.slot_start`

	rows, err := r.db.QueryContext(ctx, query, planID)
	if err != nil {
		return nil, fmt.Errorf("querying plan availability: %w", err)
	}
	defer rows.Close()

	var results []AvailabilityWithParticipant
	for rows.Next() {
		var a AvailabilityWithParticipant
		if err := rows.Scan(&a.ParticipantID, &a.DisplayName, &a.SlotStart, &a.SlotEnd, &a.Status); err != nil {
			return nil, err
		}
		results = append(results, a)
	}

	if results == nil {
		results = []AvailabilityWithParticipant{}
	}
	return results, rows.Err()
}

func (r *AvailabilityRepository) BatchUpsert(ctx context.Context, participantID int64, updates []model.AvailabilityUpdate) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	upsertStmt, err := tx.PrepareContext(ctx,
		`INSERT INTO availability (participant_id, slot_start, slot_end, status)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(participant_id, slot_start, slot_end)
		 DO UPDATE SET status = excluded.status`)
	if err != nil {
		return err
	}
	defer upsertStmt.Close()

	deleteStmt, err := tx.PrepareContext(ctx,
		`DELETE FROM availability WHERE participant_id = ? AND slot_start = ? AND slot_end = ?`)
	if err != nil {
		return err
	}
	defer deleteStmt.Close()

	for _, u := range updates {
		if u.Status == "clear" {
			if _, err := deleteStmt.ExecContext(ctx, participantID, u.SlotStart, u.SlotEnd); err != nil {
				return err
			}
		} else {
			if _, err := upsertStmt.ExecContext(ctx, participantID, u.SlotStart, u.SlotEnd, u.Status); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}
