package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/deepampatel/planfast/internal/middleware"
	"github.com/deepampatel/planfast/internal/model"
	"github.com/deepampatel/planfast/internal/service"
)

type ParticipantHandler struct {
	svc *service.AvailabilityService
}

func NewParticipantHandler(svc *service.AvailabilityService) *ParticipantHandler {
	return &ParticipantHandler{svc: svc}
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
