package middleware

import (
	"context"
	"net/http"

	"github.com/deepampatel/planfast/internal/service"
)

type contextKey string

const UserIDKey contextKey = "userId"
const UserEmailKey contextKey = "userEmail"
const UserNameKey contextKey = "userName"

// OptionalAuth extracts user info from session cookie if present.
// Does NOT reject unauthenticated requests — just enriches context.
func OptionalAuth(authSvc *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("planfast_session")
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			claims, err := authSvc.ValidateSessionJWT(cookie.Value)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
			ctx = context.WithValue(ctx, UserNameKey, claims.DisplayName)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID extracts user ID from context (0 if not authenticated)
func GetUserID(ctx context.Context) int64 {
	id, _ := ctx.Value(UserIDKey).(int64)
	return id
}

// GetUserName extracts user display name from context
func GetUserName(ctx context.Context) string {
	name, _ := ctx.Value(UserNameKey).(string)
	return name
}
