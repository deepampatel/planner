package config

import (
	"github.com/joho/godotenv"
	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	Port           int      `envconfig:"PORT" default:"8080"`
	DatabaseURL    string   `envconfig:"DATABASE_URL" default:"./data/planfast.db"`
	AllowedOrigins []string `envconfig:"ALLOWED_ORIGINS" default:"http://localhost:3000"`
	AppURL         string   `envconfig:"APP_URL" default:"http://localhost:3000"`

	// Auth
	JWTSecret      string `envconfig:"JWT_SECRET" default:"dev-secret-change-in-production"`
	GoogleClientID string `envconfig:"GOOGLE_CLIENT_ID" default:""`
	AppleClientID  string `envconfig:"APPLE_CLIENT_ID" default:""`

	// Admin
	AdminToken string `envconfig:"ADMIN_TOKEN" default:""`
}

func Load() (*Config, error) {
	// Load .env file if present (ignored if missing)
	_ = godotenv.Load()

	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
