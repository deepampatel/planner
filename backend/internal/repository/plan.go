package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/deepampatel/planfast/internal/model"
)

type PlanRepository struct {
	db *sql.DB
}

func NewPlanRepository(db *sql.DB) *PlanRepository {
	return &PlanRepository{db: db}
}

type CreatePlanParams struct {
	Slug            string
	CustomSlug      *string
	Title           string
	Location        string
	DateRangeStart  string
	DateRangeEnd    string
	DurationMinutes int
	Granularity     string
	HostToken       string
	Status          string
	Timezone        string
	ExpiresAt       string
	CustomOptions   *string // JSON string, nullable
}

func (r *PlanRepository) Create(ctx context.Context, p CreatePlanParams) (*model.Plan, error) {
	query := `
		INSERT INTO plans (slug, custom_slug, title, location, date_range_start, date_range_end,
			duration_minutes, granularity, host_token, status, timezone, custom_options, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING id, slug, custom_slug, title, location, date_range_start, date_range_end,
			duration_minutes, granularity, status, timezone, custom_options, created_at, updated_at, expires_at`

	var plan model.Plan
	var customSlug sql.NullString
	var customOptions sql.NullString
	err := r.db.QueryRowContext(ctx, query,
		p.Slug, p.CustomSlug, p.Title, p.Location, p.DateRangeStart, p.DateRangeEnd,
		p.DurationMinutes, p.Granularity, p.HostToken, p.Status, p.Timezone, p.CustomOptions, p.ExpiresAt,
	).Scan(
		&plan.ID, &plan.Slug, &customSlug, &plan.Title, &plan.Location,
		&plan.DateRangeStart, &plan.DateRangeEnd, &plan.DurationMinutes,
		&plan.Granularity, &plan.Status, &plan.Timezone, &customOptions,
		&plan.CreatedAt, &plan.UpdatedAt, &plan.ExpiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting plan: %w", err)
	}

	if customSlug.Valid {
		plan.CustomSlug = &customSlug.String
	}
	if customOptions.Valid {
		plan.CustomOptions = json.RawMessage(customOptions.String)
	}
	plan.Participants = []model.Participant{}

	return &plan, nil
}

func (r *PlanRepository) GetBySlug(ctx context.Context, slug string) (*model.Plan, error) {
	query := `
		SELECT id, slug, custom_slug, title, location, date_range_start, date_range_end,
			duration_minutes, granularity, host_token, status, timezone, custom_options, created_at, updated_at, expires_at
		FROM plans
		WHERE slug = ? OR custom_slug = ?
		LIMIT 1`

	var plan model.Plan
	var customSlug sql.NullString
	var customOptions sql.NullString
	var hostToken string
	err := r.db.QueryRowContext(ctx, query, slug, slug).Scan(
		&plan.ID, &plan.Slug, &customSlug, &plan.Title, &plan.Location,
		&plan.DateRangeStart, &plan.DateRangeEnd, &plan.DurationMinutes,
		&plan.Granularity, &hostToken, &plan.Status, &plan.Timezone, &customOptions,
		&plan.CreatedAt, &plan.UpdatedAt, &plan.ExpiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("querying plan: %w", err)
	}

	if customSlug.Valid {
		plan.CustomSlug = &customSlug.String
	}
	if customOptions.Valid {
		plan.CustomOptions = json.RawMessage(customOptions.String)
	}

	return &plan, nil
}

func (r *PlanRepository) GetByID(ctx context.Context, id int64) (*model.Plan, error) {
	query := `
		SELECT id, slug, custom_slug, title, location, date_range_start, date_range_end,
			duration_minutes, granularity, host_token, status, timezone, custom_options, created_at, updated_at, expires_at
		FROM plans
		WHERE id = ?
		LIMIT 1`

	var plan model.Plan
	var customSlug sql.NullString
	var customOptions sql.NullString
	var hostToken string
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&plan.ID, &plan.Slug, &customSlug, &plan.Title, &plan.Location,
		&plan.DateRangeStart, &plan.DateRangeEnd, &plan.DurationMinutes,
		&plan.Granularity, &hostToken, &plan.Status, &plan.Timezone, &customOptions,
		&plan.CreatedAt, &plan.UpdatedAt, &plan.ExpiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("querying plan by id: %w", err)
	}

	if customSlug.Valid {
		plan.CustomSlug = &customSlug.String
	}
	if customOptions.Valid {
		plan.CustomOptions = json.RawMessage(customOptions.String)
	}

	return &plan, nil
}

func (r *PlanRepository) GetHostToken(ctx context.Context, planID int64) (string, error) {
	var token string
	err := r.db.QueryRowContext(ctx, "SELECT host_token FROM plans WHERE id = ?", planID).Scan(&token)
	return token, err
}

func (r *PlanRepository) SlugExists(ctx context.Context, slug string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM plans WHERE slug = ? OR custom_slug = ?)",
		slug, slug,
	).Scan(&exists)
	return exists, err
}

func (r *PlanRepository) Lock(ctx context.Context, planID int64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE plans SET status = 'locked', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ? AND status = 'active'`,
		planID,
	)
	return err
}

func (r *PlanRepository) TouchUpdatedAt(ctx context.Context, planID int64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE plans SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
		planID,
	)
	return err
}

func (r *PlanRepository) ExpireStale(ctx context.Context) (int64, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE plans SET status = 'expired', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
		 WHERE status = 'active' AND expires_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
