package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/deepampatel/planfast/internal/model"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, email, displayName, avatarURL, provider, providerID string) (*model.User, error) {
	query := `
		INSERT INTO users (email, display_name, avatar_url, provider, provider_id)
		VALUES (?, ?, ?, ?, ?)
		RETURNING id, email, display_name, avatar_url, provider, provider_id, created_at, updated_at`

	var u model.User
	err := r.db.QueryRowContext(ctx, query, email, displayName, avatarURL, provider, providerID).Scan(
		&u.ID, &u.Email, &u.DisplayName, &u.AvatarURL, &u.Provider, &u.ProviderID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting user: %w", err)
	}
	return &u, nil
}

func (r *UserRepository) GetByProviderID(ctx context.Context, provider, providerID string) (*model.User, error) {
	query := `SELECT id, email, display_name, avatar_url, provider, provider_id, created_at, updated_at
		FROM users WHERE provider = ? AND provider_id = ?`

	var u model.User
	err := r.db.QueryRowContext(ctx, query, provider, providerID).Scan(
		&u.ID, &u.Email, &u.DisplayName, &u.AvatarURL, &u.Provider, &u.ProviderID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) GetByID(ctx context.Context, id int64) (*model.User, error) {
	query := `SELECT id, email, display_name, avatar_url, provider, provider_id, created_at, updated_at
		FROM users WHERE id = ?`

	var u model.User
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID, &u.Email, &u.DisplayName, &u.AvatarURL, &u.Provider, &u.ProviderID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `SELECT id, email, display_name, avatar_url, provider, provider_id, created_at, updated_at
		FROM users WHERE email = ?`

	var u model.User
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&u.ID, &u.Email, &u.DisplayName, &u.AvatarURL, &u.Provider, &u.ProviderID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) UpdateProfile(ctx context.Context, id int64, displayName, avatarURL string) error {
	query := `UPDATE users SET display_name = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, displayName, avatarURL, id)
	return err
}
