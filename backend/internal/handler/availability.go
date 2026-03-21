package handler

import (
	"encoding/json"
	"net/http"

	"github.com/deepampatel/planfast/internal/model"
	"github.com/deepampatel/planfast/internal/service"
)

type AvailabilityHandler struct {
	svc *service.AvailabilityService
}

func NewAvailabilityHandler(svc *service.AvailabilityService) *AvailabilityHandler {
	return &AvailabilityHandler{svc: svc}
}

type updateAvailabilityRequest struct {
	Updates []model.AvailabilityUpdate `json:"updates"`
}

func (h *AvailabilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	editToken := r.Header.Get("X-Edit-Token")
	if editToken == "" {
		respondError(w, http.StatusUnauthorized, "edit token required")
		return
	}

	var req updateAvailabilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.Updates) == 0 {
		respondError(w, http.StatusUnprocessableEntity, "at least one update is required")
		return
	}

	if err := h.svc.Update(r.Context(), editToken, req.Updates); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
