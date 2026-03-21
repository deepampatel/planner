package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/deepampatel/planfast/internal/service"
)

type HeatmapHandler struct {
	svc *service.HeatmapService
}

func NewHeatmapHandler(svc *service.HeatmapService) *HeatmapHandler {
	return &HeatmapHandler{svc: svc}
}

func (h *HeatmapHandler) Get(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	heatmap, err := h.svc.Compute(r.Context(), slug)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, heatmap)
}
