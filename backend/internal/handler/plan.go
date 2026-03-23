package handler

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/deepampatel/planfast/internal/middleware"
	"github.com/deepampatel/planfast/internal/model"
	"github.com/deepampatel/planfast/internal/repository"
	"github.com/deepampatel/planfast/internal/service"
)

type PlanHandler struct {
	svc       *service.PlanService
	auditRepo *repository.AuditRepository
}

func NewPlanHandler(svc *service.PlanService, auditRepo *repository.AuditRepository) *PlanHandler {
	return &PlanHandler{svc: svc, auditRepo: auditRepo}
}

func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input model.CreatePlanInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if input.Title == "" {
		respondError(w, http.StatusUnprocessableEntity, "title is required")
		return
	}

	// Validate custom options for "options" granularity
	if input.Granularity == "options" {
		if len(input.CustomOptions) == 0 {
			respondError(w, http.StatusUnprocessableEntity, "customOptions required for options granularity")
			return
		}
		var options []model.CustomOption
		if err := json.Unmarshal(input.CustomOptions, &options); err != nil {
			respondError(w, http.StatusUnprocessableEntity, "invalid customOptions format")
			return
		}
		if len(options) < 2 {
			respondError(w, http.StatusUnprocessableEntity, "at least 2 options required")
			return
		}
		if len(options) > 10 {
			respondError(w, http.StatusUnprocessableEntity, "maximum 10 options allowed")
			return
		}
		seen := make(map[string]bool)
		for _, opt := range options {
			if opt.Label == "" {
				respondError(w, http.StatusUnprocessableEntity, "option labels cannot be empty")
				return
			}
			if seen[opt.Label] {
				respondError(w, http.StatusUnprocessableEntity, "duplicate option label: "+opt.Label)
				return
			}
			seen[opt.Label] = true
		}
		// Default dates for options mode
		if input.DateRangeStart == "" {
			input.DateRangeStart = fmt.Sprintf("%d-%02d-%02d", time.Now().Year(), time.Now().Month(), time.Now().Day())
		}
		if input.DateRangeEnd == "" {
			input.DateRangeEnd = input.DateRangeStart
		}
	} else {
		if input.DateRangeStart == "" || input.DateRangeEnd == "" {
			respondError(w, http.StatusUnprocessableEntity, "date range is required")
			return
		}
	}

	result, err := h.svc.Create(r.Context(), input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, result)
}

func (h *PlanHandler) Get(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	editToken := r.Header.Get("X-Edit-Token")

	userID := middleware.GetUserID(r.Context())
	plan, err := h.svc.GetBySlug(r.Context(), slug, editToken, userID)
	if err != nil {
		respondError(w, http.StatusNotFound, "plan not found")
		return
	}

	// ETag support for efficient polling
	etag := fmt.Sprintf(`"%x"`, sha256.Sum256([]byte(plan.UpdatedAt)))
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set("ETag", etag)
	respondJSON(w, http.StatusOK, plan)
}

func (h *PlanHandler) Lock(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	hostToken := r.Header.Get("X-Edit-Token")

	if hostToken == "" {
		respondError(w, http.StatusUnauthorized, "host token required")
		return
	}

	if err := h.svc.Lock(r.Context(), slug, hostToken); err != nil {
		respondError(w, http.StatusForbidden, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "locked"})
}

func (h *PlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	hostToken := r.Header.Get("X-Edit-Token")

	var input struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.svc.UpdateTitle(r.Context(), slug, hostToken, input.Title); err != nil {
		if err.Error() == "unauthorized: invalid host token" {
			respondError(w, http.StatusForbidden, "not authorized")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *PlanHandler) Activity(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	plan, err := h.svc.GetBySlug(r.Context(), slug, "", 0)
	if err != nil {
		respondError(w, http.StatusNotFound, "plan not found")
		return
	}

	entries, err := h.auditRepo.GetByPlanID(r.Context(), plan.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, entries)
}
