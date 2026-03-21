package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/sqlite"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/deepampatel/planfast/internal/config"
	"github.com/deepampatel/planfast/internal/db"
	"github.com/deepampatel/planfast/internal/repository"
	"github.com/deepampatel/planfast/internal/router"
	"github.com/deepampatel/planfast/internal/service"
)

func main() {
	// Pretty logging for development
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	// Ensure data directory exists
	dataDir := filepath.Dir(cfg.DatabaseURL)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatal().Err(err).Msg("failed to create data directory")
	}

	// Run migrations
	migrationsPath := "file://migrations"
	dbURL := fmt.Sprintf("sqlite://%s", cfg.DatabaseURL)
	m, err := migrate.New(migrationsPath, dbURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create migrator")
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal().Err(err).Msg("failed to run migrations")
	}
	log.Info().Msg("migrations applied")

	// Open database
	database, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to open database")
	}
	defer database.Close()

	// Wire dependencies
	planRepo := repository.NewPlanRepository(database)
	participantRepo := repository.NewParticipantRepository(database)
	availRepo := repository.NewAvailabilityRepository(database)

	userRepo := repository.NewUserRepository(database)

	planSvc := service.NewPlanService(planRepo, participantRepo, availRepo)
	availSvc := service.NewAvailabilityService(availRepo, participantRepo, planRepo)
	heatmapSvc := service.NewHeatmapService(availRepo, planRepo, participantRepo)
	authSvc := service.NewAuthService(userRepo, participantRepo, cfg.JWTSecret, cfg.GoogleClientID, cfg.AppleClientID)

	// Start expiry worker
	startExpiryWorker(planRepo)

	// Create router
	r := router.New(cfg.AllowedOrigins, planSvc, availSvc, heatmapSvc, authSvc)

	// Start server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Int("port", cfg.Port).Msg("starting server")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server failed")
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func startExpiryWorker(repo *repository.PlanRepository) {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			count, err := repo.ExpireStale(ctx)
			if err != nil {
				log.Error().Err(err).Msg("failed to expire stale plans")
			} else if count > 0 {
				log.Info().Int64("count", count).Msg("expired stale plans")
			}
			cancel()
		}
	}()
}
