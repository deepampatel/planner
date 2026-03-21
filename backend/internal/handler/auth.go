package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/deepampatel/planfast/internal/model"
	"github.com/deepampatel/planfast/internal/service"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type googleAuthRequest struct {
	IDToken string `json:"idToken"`
}

type appleAuthRequest struct {
	IDToken  string `json:"idToken"`
	UserName string `json:"userName"`
}

const sessionCookieName = "planfast_session"

func (h *AuthHandler) Google(w http.ResponseWriter, r *http.Request) {
	var req googleAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.IDToken == "" {
		respondError(w, http.StatusUnprocessableEntity, "idToken is required")
		return
	}

	user, err := h.svc.VerifyGoogleToken(r.Context(), req.IDToken)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "authentication failed: "+err.Error())
		return
	}

	h.setSessionAndRespond(w, user)
}

func (h *AuthHandler) Apple(w http.ResponseWriter, r *http.Request) {
	var req appleAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.IDToken == "" {
		respondError(w, http.StatusUnprocessableEntity, "idToken is required")
		return
	}

	user, err := h.svc.VerifyAppleToken(r.Context(), req.IDToken, req.UserName)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "authentication failed: "+err.Error())
		return
	}

	h.setSessionAndRespond(w, user)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	// Extract session cookie
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	claims, err := h.svc.ValidateSessionJWT(cookie.Value)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "invalid session")
		return
	}

	user, err := h.svc.GetUserByID(r.Context(), claims.UserID)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "user not found")
		return
	}

	respondJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	})

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *AuthHandler) setSessionAndRespond(w http.ResponseWriter, user *model.User) {
	tokenStr, err := h.svc.GenerateSessionJWT(user)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    tokenStr,
		Path:     "/",
		MaxAge:   int(30 * 24 * time.Hour / time.Second),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	respondJSON(w, http.StatusOK, user)
}
