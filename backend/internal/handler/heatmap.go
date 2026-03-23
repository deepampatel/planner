package handler

import (
	"net/http"
	"strconv"
	"strings"

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

	var participantIDs []int64
	if pStr := r.URL.Query().Get("participants"); pStr != "" {
		for _, s := range strings.Split(pStr, ",") {
			id, err := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
			if err == nil {
				participantIDs = append(participantIDs, id)
			}
		}
	}

	heatmap, err := h.svc.Compute(r.Context(), slug, participantIDs)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, heatmap)
}
