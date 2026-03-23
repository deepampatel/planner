package repository

import (
	"context"
	"database/sql"
)

type AuditEntry struct {
	ID        int64  `json:"id"`
	PlanID    int64  `json:"planId"`
	ActorName string `json:"actorName"`
	Action    string `json:"action"`
	Details   string `json:"details"`
	CreatedAt string `json:"createdAt"`
}

type AuditRepository struct {
	db *sql.DB
}

func NewAuditRepository(db *sql.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) Log(ctx context.Context, planID int64, actorName, action, details string) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO audit_logs (plan_id, actor_name, action, details) VALUES (?, ?, ?, ?)",
		planID, actorName, action, details)
	return err
}

func (r *AuditRepository) GetByPlanID(ctx context.Context, planID int64) ([]AuditEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		"SELECT id, plan_id, actor_name, action, details, created_at FROM audit_logs WHERE plan_id = ? ORDER BY created_at DESC LIMIT 100",
		planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []AuditEntry
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.ID, &e.PlanID, &e.ActorName, &e.Action, &e.Details, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []AuditEntry{}
	}
	return entries, rows.Err()
}
