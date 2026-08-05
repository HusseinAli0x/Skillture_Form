package auth

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"skillture/backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// ContextKeyAdminID is the gin context key holding the authenticated admin's ID.
const ContextKeyAdminID = "admin_id"

// ContextKeyAdminUsername is the gin context key holding the authenticated
// admin's username.
const ContextKeyAdminUsername = "admin_username"

// ErrInvalidToken is returned when a token fails signature or claim validation.
var ErrInvalidToken = errors.New("invalid or expired token")

// AdminClaims is the JWT payload issued on successful admin login.
type AdminClaims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// TokenIssuer signs and verifies admin access tokens.
//
// Before this existed, LoginAdmin returned the constant string
// "dummy-token-123" and no middleware verified anything, so every route —
// including admin creation and deletion — was open to anonymous callers.
type TokenIssuer struct {
	secret   []byte
	issuer   string
	lifetime time.Duration
}

// NewTokenIssuer builds a TokenIssuer from JWT configuration.
// cfg.Validate() already rejects a secret shorter than 32 bytes.
func NewTokenIssuer(cfg config.JWTConfig) *TokenIssuer {
	return &TokenIssuer{
		secret:   []byte(cfg.Secret),
		issuer:   cfg.Issuer,
		lifetime: cfg.AccessTokenDuration(),
	}
}

// Issue returns a signed access token for the given admin.
func (ti *TokenIssuer) Issue(adminID uuid.UUID, username string) (string, time.Time, error) {
	expiresAt := time.Now().Add(ti.lifetime)

	claims := AdminClaims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   adminID.String(),
			Issuer:    ti.issuer,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(ti.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign token: %w", err)
	}
	return signed, expiresAt, nil
}

// Verify parses and validates a token, returning its claims.
func (ti *TokenIssuer) Verify(token string) (*AdminClaims, error) {
	claims := &AdminClaims{}

	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		// Pin the algorithm. Without this check a caller could present an
		// "alg": "none" token, or an RS256 token verified against the HMAC
		// secret as if it were a public key.
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return ti.secret, nil
	}, jwt.WithIssuer(ti.issuer), jwt.WithExpirationRequired())

	if err != nil || !parsed.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// RequireAdmin rejects any request without a valid admin access token.
func RequireAdmin(ti *TokenIssuer) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || strings.TrimSpace(token) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}

		claims, err := ti.Verify(strings.TrimSpace(token))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		adminID, err := uuid.Parse(claims.Subject)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(ContextKeyAdminID, adminID)
		c.Set(ContextKeyAdminUsername, claims.Username)
		c.Next()
	}
}

// AdminIDFromContext returns the authenticated admin's ID. The boolean is false
// on routes that are not behind RequireAdmin.
func AdminIDFromContext(c *gin.Context) (uuid.UUID, bool) {
	v, exists := c.Get(ContextKeyAdminID)
	if !exists {
		return uuid.Nil, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}
