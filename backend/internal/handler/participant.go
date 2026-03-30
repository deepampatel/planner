package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/deepampatel/planfast/internal/middleware"
	"github.com/deepampatel/planfast/internal/model"
	"github.com/deepampatel/planfast/internal/repository"
	"github.com/deepampatel/planfast/internal/service"
)

type ParticipantHandler struct {
	svc             *service.AvailabilityService
	planSvc         *service.PlanService
	participantRepo *repository.ParticipantRepository
}

func NewParticipantHandler(svc *service.AvailabilityService, planSvc *service.PlanService, participantRepo *repository.ParticipantRepository) *ParticipantHandler {
	return &ParticipantHandler{svc: svc, planSvc: planSvc, participantRepo: participantRepo}
}

func (h *ParticipantHandler) Join(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var input model.JoinPlanInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if input.DisplayName == "" {
		respondError(w, http.StatusUnprocessableEntity, "displayName is required")
		return
	}

	userID := middleware.GetUserID(r.Context())
	result, err := h.svc.Join(r.Context(), slug, input, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, result)
}

// Recover returns the editToken for an existing participant (tap-to-recover).
func (h *ParticipantHandler) Recover(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var input struct {
		ParticipantID int64 `json:"participantId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if input.ParticipantID == 0 {
		respondError(w, http.StatusUnprocessableEntity, "participantId is required")
		return
	}

	// Look up the plan to get plan ID
	plan, err := h.planSvc.GetBySlug(r.Context(), slug, "", 0)
	if err != nil {
		respondError(w, http.StatusNotFound, "plan not found")
		return
	}

	// Get the edit token for this participant
	token, err := h.participantRepo.GetEditTokenByID(r.Context(), input.ParticipantID, plan.ID)
	if err != nil {
		respondError(w, http.StatusNotFound, "participant not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"editToken": token})
}
