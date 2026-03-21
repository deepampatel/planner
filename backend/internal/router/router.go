package router

import (
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"github.com/deepampatel/planfast/internal/handler"
	"github.com/deepampatel/planfast/internal/middleware"
	"github.com/deepampatel/planfast/internal/service"
)

func New(
	allowedOrigins []string,
	planSvc *service.PlanService,
	availSvc *service.AvailabilityService,
	heatmapSvc *service.HeatmapService,
	authSvc *service.AuthService,
) chi.Router {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(30 * time.Second))
	r.Use(middleware.CORS(allowedOrigins))

	// Optional auth middleware — enriches context with user info from cookie
	r.Use(middleware.OptionalAuth(authSvc))

	// Handlers
	planH := handler.NewPlanHandler(planSvc)
	participantH := handler.NewParticipantHandler(availSvc)
	availH := handler.NewAvailabilityHandler(availSvc)
	heatmapH := handler.NewHeatmapHandler(heatmapSvc)
	authH := handler.NewAuthHandler(authSvc)

	// Health check
	r.Get("/health", handler.Health)

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/google", authH.Google)
			r.Post("/apple", authH.Apple)
			r.Get("/me", authH.Me)
			r.Post("/logout", authH.Logout)
		})

		r.Route("/plans", func(r chi.Router) {
			r.Post("/", planH.Create)

			r.Route("/{slug}", func(r chi.Router) {
				r.Get("/", planH.Get)
				r.Post("/join", participantH.Join)
				r.Put("/availability", availH.Update)
				r.Post("/lock", planH.Lock)
				r.Get("/heatmap", heatmapH.Get)
			})
		})
	})

	return r
}
