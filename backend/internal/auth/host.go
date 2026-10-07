package auth

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// HostKeyHeader carries a visitor's host key.
//
// Anyone can create and host a game without an account. Instead of a login,
// the browser generates a long random key once, keeps it in local storage and
// sends it on every request. It proves "I am the browser that created this
// game". The server never stores the key itself — only its SHA-256 hash — so
// a database leak does not hand out control of anyone's games.
const HostKeyHeader = "X-Host-Key"

// ContextKeyHostHash is the gin context key holding the hash of the caller's
// host key.
const ContextKeyHostHash = "host_key_hash"

// A host key is a base64url string of at least 32 characters (>= 190 bits when
// generated from random bytes). The upper bound keeps hostile input small.
var hostKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{32,128}$`)

// HashHostKey returns the storage form of a host key and whether the key was
// well formed.
func HashHostKey(key string) (string, bool) {
	if !hostKeyPattern.MatchString(key) {
		return "", false
	}
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:]), true
}

// Principal is who is making an authenticated request: an admin, or an
// anonymous host identified by the hash of their host key.
type Principal struct {
	AdminID  uuid.UUID // set for admins
	HostHash string    // set for visitors hosting with a host key
}

// IsAdmin reports whether the caller is a signed-in admin.
func (p Principal) IsAdmin() bool { return p.AdminID != uuid.Nil }

// Owns reports whether the principal may manage a resource whose owner hash is
// ownerHash (nil for resources created by an admin). Admins manage everything;
// a host manages only what carries their own hash.
func (p Principal) Owns(ownerHash *string) bool {
	if p.IsAdmin() {
		return true
	}
	if p.HostHash == "" || ownerHash == nil {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(p.HostHash), []byte(*ownerHash)) == 1
}

// RequireAdminOrHost lets a request through if it carries a valid admin
// access token or, failing that, a well-formed host key. It does not decide
// what the caller may touch — handlers check ownership against the Principal.
//
// An admin token is tried first. A stale one (expired in a browser that also
// hosts games) must not lock the person out, so a bad token falls through to
// the host key rather than failing outright.
func RequireAdminOrHost(ti *TokenIssuer) gin.HandlerFunc {
	return func(c *gin.Context) {
		if token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer "); ok && strings.TrimSpace(token) != "" {
			if claims, err := ti.Verify(strings.TrimSpace(token)); err == nil {
				if adminID, err := uuid.Parse(claims.Subject); err == nil {
					c.Set(ContextKeyAdminID, adminID)
					c.Set(ContextKeyAdminUsername, claims.Username)
					c.Next()
					return
				}
			}
		}

		if hash, ok := HashHostKey(strings.TrimSpace(c.GetHeader(HostKeyHeader))); ok {
			c.Set(ContextKeyHostHash, hash)
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing credentials"})
	}
}

// PrincipalFromContext returns the caller's identity. The boolean is false on
// routes that are not behind RequireAdminOrHost (or RequireAdmin).
func PrincipalFromContext(c *gin.Context) (Principal, bool) {
	if id, ok := AdminIDFromContext(c); ok {
		return Principal{AdminID: id}, true
	}
	if v, exists := c.Get(ContextKeyHostHash); exists {
		if hash, ok := v.(string); ok && hash != "" {
			return Principal{HostHash: hash}, true
		}
	}
	return Principal{}, false
}
