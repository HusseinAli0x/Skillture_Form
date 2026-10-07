package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"skillture/backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const goodKey = "abcdefghijklmnopqrstuvwxyz0123456789_-ABCDEFG" // 45 chars

func testIssuer() *TokenIssuer {
	return NewTokenIssuer(config.JWTConfig{
		Secret:          strings.Repeat("s", 40),
		Issuer:          "test",
		AccessExpireMin: 5,
	})
}

func TestHashHostKey(t *testing.T) {
	cases := []struct {
		name string
		key  string
		ok   bool
	}{
		{"valid", goodKey, true},
		{"too short", "short", false},
		{"empty", "", false},
		{"too long", strings.Repeat("a", 129), false},
		{"bad characters", strings.Repeat("a", 31) + "!", false},
		{"whitespace", strings.Repeat("a", 31) + " ", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			hash, ok := HashHostKey(tc.key)
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v", ok, tc.ok)
			}
			if ok && len(hash) != 64 {
				t.Fatalf("hash length = %d, want 64 hex chars", len(hash))
			}
			if ok && strings.Contains(hash, tc.key) {
				t.Fatal("hash must not contain the key")
			}
		})
	}

	a, _ := HashHostKey(goodKey)
	b, _ := HashHostKey(goodKey)
	if a != b {
		t.Fatal("hashing must be deterministic")
	}
}

func TestPrincipalOwns(t *testing.T) {
	mine, _ := HashHostKey(goodKey)
	other, _ := HashHostKey(strings.Repeat("z", 40))

	admin := Principal{AdminID: uuid.New()}
	host := Principal{HostHash: mine}
	anon := Principal{}

	if !admin.Owns(nil) || !admin.Owns(&other) {
		t.Error("admins manage everything, including admin-created (nil owner) quizzes")
	}
	if !host.Owns(&mine) {
		t.Error("a host manages its own quiz")
	}
	if host.Owns(&other) {
		t.Error("a host must not manage someone else's quiz")
	}
	if host.Owns(nil) {
		t.Error("a host must not manage an admin-created quiz")
	}
	if anon.Owns(&mine) || anon.Owns(nil) {
		t.Error("an empty principal owns nothing")
	}
}

func TestRequireAdminOrHost(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ti := testIssuer()
	adminID := uuid.New()
	adminToken, _, err := ti.Issue(adminID, "root")
	if err != nil {
		t.Fatal(err)
	}
	hostHash, _ := HashHostKey(goodKey)

	r := gin.New()
	r.Use(RequireAdminOrHost(ti))
	r.GET("/", func(c *gin.Context) {
		p, ok := PrincipalFromContext(c)
		if !ok {
			c.Status(http.StatusInternalServerError)
			return
		}
		switch {
		case p.IsAdmin() && p.AdminID == adminID:
			c.String(http.StatusOK, "admin")
		case p.HostHash == hostHash:
			c.String(http.StatusOK, "host")
		default:
			c.Status(http.StatusInternalServerError)
		}
	})

	do := func(headers map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	t.Run("admin token", func(t *testing.T) {
		w := do(map[string]string{"Authorization": "Bearer " + adminToken})
		if w.Code != http.StatusOK || w.Body.String() != "admin" {
			t.Fatalf("got %d %q", w.Code, w.Body.String())
		}
	})
	t.Run("host key", func(t *testing.T) {
		w := do(map[string]string{HostKeyHeader: goodKey})
		if w.Code != http.StatusOK || w.Body.String() != "host" {
			t.Fatalf("got %d %q", w.Code, w.Body.String())
		}
	})
	t.Run("admin wins when both are sent", func(t *testing.T) {
		w := do(map[string]string{"Authorization": "Bearer " + adminToken, HostKeyHeader: goodKey})
		if w.Body.String() != "admin" {
			t.Fatalf("got %q", w.Body.String())
		}
	})
	t.Run("stale admin token falls back to the host key", func(t *testing.T) {
		w := do(map[string]string{"Authorization": "Bearer not-a-real-token", HostKeyHeader: goodKey})
		if w.Code != http.StatusOK || w.Body.String() != "host" {
			t.Fatalf("got %d %q", w.Code, w.Body.String())
		}
	})
	t.Run("no credentials", func(t *testing.T) {
		if w := do(nil); w.Code != http.StatusUnauthorized {
			t.Fatalf("got %d", w.Code)
		}
	})
	t.Run("malformed host key", func(t *testing.T) {
		if w := do(map[string]string{HostKeyHeader: "tiny"}); w.Code != http.StatusUnauthorized {
			t.Fatalf("got %d", w.Code)
		}
	})
	t.Run("bad token and no key", func(t *testing.T) {
		if w := do(map[string]string{"Authorization": "Bearer nope"}); w.Code != http.StatusUnauthorized {
			t.Fatalf("got %d", w.Code)
		}
	})
}
