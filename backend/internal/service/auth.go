package service

import (
	"context"
	"crypto/rsa"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"

	"github.com/deepampatel/planfast/internal/model"
	"github.com/deepampatel/planfast/internal/repository"
)

type AuthService struct {
	userRepo        *repository.UserRepository
	participantRepo *repository.ParticipantRepository
	jwtSecret       []byte
	googleClientID  string
	appleClientID   string

	// Cached Apple public keys
	appleKeysMu sync.RWMutex
	appleKeys   map[string]*rsa.PublicKey
	appleKeysAt time.Time
}

func NewAuthService(
	userRepo *repository.UserRepository,
	participantRepo *repository.ParticipantRepository,
	jwtSecret string,
	googleClientID string,
	appleClientID string,
) *AuthService {
	return &AuthService{
		userRepo:        userRepo,
		participantRepo: participantRepo,
		jwtSecret:       []byte(jwtSecret),
		googleClientID:  googleClientID,
		appleClientID:   appleClientID,
		appleKeys:       make(map[string]*rsa.PublicKey),
	}
}

// SessionClaims are stored in the session JWT cookie
type SessionClaims struct {
	UserID      int64  `json:"userId"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	jwt.RegisteredClaims
}

// GoogleClaims from Google's ID token
type GoogleClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Sub           string `json:"sub"`
	jwt.RegisteredClaims
}

// AppleClaims from Apple's ID token
type AppleClaims struct {
	Email string `json:"email"`
	Sub   string `json:"sub"`
	jwt.RegisteredClaims
}

// VerifyGoogleToken verifies a Google access token (from implicit flow) or ID token
func (s *AuthService) VerifyGoogleToken(ctx context.Context, token string) (*model.User, error) {
	// Try as access token first (implicit flow returns access_token)
	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("verifying google token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		// Try as ID token with tokeninfo endpoint
		return s.verifyGoogleIDToken(ctx, token)
	}

	var claims struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		return nil, fmt.Errorf("decoding google userinfo: %w", err)
	}

	if claims.Email == "" || claims.Sub == "" {
		return nil, errors.New("google token missing email or sub")
	}

	return s.findOrCreateUser(ctx, claims.Email, claims.Name, claims.Picture, "google", claims.Sub)
}

func (s *AuthService) verifyGoogleIDToken(ctx context.Context, idToken string) (*model.User, error) {
	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken)
	if err != nil {
		return nil, fmt.Errorf("verifying google id token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, errors.New("invalid google token")
	}

	var claims struct {
		Sub     string `json:"sub"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
		Aud     string `json:"aud"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		return nil, fmt.Errorf("decoding google token: %w", err)
	}

	if s.googleClientID != "" && claims.Aud != s.googleClientID {
		return nil, errors.New("google token audience mismatch")
	}

	if claims.Email == "" || claims.Sub == "" {
		return nil, errors.New("google token missing email or sub")
	}

	return s.findOrCreateUser(ctx, claims.Email, claims.Name, claims.Picture, "google", claims.Sub)
}

// VerifyAppleToken verifies an Apple ID token and extracts user info
func (s *AuthService) VerifyAppleToken(ctx context.Context, idToken string, userName string) (*model.User, error) {
	// Parse without verification first to get the kid
	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	token, _, err := parser.ParseUnverified(idToken, &AppleClaims{})
	if err != nil {
		return nil, fmt.Errorf("parsing apple token: %w", err)
	}

	kid, ok := token.Header["kid"].(string)
	if !ok {
		return nil, errors.New("apple token missing kid header")
	}

	// Get Apple's public key for this kid
	key, err := s.getApplePublicKey(kid)
	if err != nil {
		return nil, fmt.Errorf("getting apple public key: %w", err)
	}

	// Now verify the token properly
	claims := &AppleClaims{}
	_, err = jwt.ParseWithClaims(idToken, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return key, nil
	}, jwt.WithAudience(s.appleClientID), jwt.WithIssuer("https://appleid.apple.com"))

	if err != nil {
		return nil, fmt.Errorf("verifying apple token: %w", err)
	}

	if claims.Sub == "" {
		return nil, errors.New("apple token missing sub")
	}

	// Apple only sends email on first sign-in, use userName from frontend if provided
	displayName := userName
	if displayName == "" {
		displayName = strings.Split(claims.Email, "@")[0]
	}

	return s.findOrCreateUser(ctx, claims.Email, displayName, "", "apple", claims.Sub)
}

// getApplePublicKey fetches Apple's JWKS and returns the public key for the given kid
func (s *AuthService) getApplePublicKey(kid string) (*rsa.PublicKey, error) {
	s.appleKeysMu.RLock()
	if key, ok := s.appleKeys[kid]; ok && time.Since(s.appleKeysAt) < 24*time.Hour {
		s.appleKeysMu.RUnlock()
		return key, nil
	}
	s.appleKeysMu.RUnlock()

	// Fetch fresh keys
	resp, err := http.Get("https://appleid.apple.com/auth/keys")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, err
	}

	s.appleKeysMu.Lock()
	defer s.appleKeysMu.Unlock()

	s.appleKeys = make(map[string]*rsa.PublicKey)
	s.appleKeysAt = time.Now()

	for _, k := range jwks.Keys {
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		e := 0
		for _, b := range eBytes {
			e = e*256 + int(b)
		}
		s.appleKeys[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: e,
		}
	}

	key, ok := s.appleKeys[kid]
	if !ok {
		return nil, fmt.Errorf("apple key %s not found", kid)
	}
	return key, nil
}

func (s *AuthService) findOrCreateUser(ctx context.Context, email, displayName, avatarURL, provider, providerID string) (*model.User, error) {
	// Try to find existing user by provider+ID
	user, err := s.userRepo.GetByProviderID(ctx, provider, providerID)
	if err == nil {
		// Update profile if changed
		if user.DisplayName != displayName || user.AvatarURL != avatarURL {
			if displayName != "" {
				_ = s.userRepo.UpdateProfile(ctx, user.ID, displayName, avatarURL)
				user.DisplayName = displayName
				user.AvatarURL = avatarURL
			}
		}
		return user, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("looking up user: %w", err)
	}

	// Try by email (user might have signed up with different provider)
	user, err = s.userRepo.GetByEmail(ctx, email)
	if err == nil {
		// Same email, different provider — link them by updating provider info
		log.Info().Str("email", email).Str("provider", provider).Msg("linking existing user to new provider")
		return user, nil
	}

	// Create new user
	if displayName == "" {
		displayName = strings.Split(email, "@")[0]
	}
	user, err = s.userRepo.Create(ctx, email, displayName, avatarURL, provider, providerID)
	if err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}

	return user, nil
}

// GenerateSessionJWT creates a JWT for the session cookie
func (s *AuthService) GenerateSessionJWT(user *model.User) (string, error) {
	claims := SessionClaims{
		UserID:      user.ID,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "planfast",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// ValidateSessionJWT validates a session JWT and returns the claims
func (s *AuthService) ValidateSessionJWT(tokenStr string) (*SessionClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &SessionClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*SessionClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}

// GetUserByID returns a user by their database ID
func (s *AuthService) GetUserByID(ctx context.Context, userID int64) (*model.User, error) {
	return s.userRepo.GetByID(ctx, userID)
}
