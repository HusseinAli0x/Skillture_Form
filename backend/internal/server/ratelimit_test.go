package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"skillture/backend/internal/auth"
	"skillture/backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeClock struct{ t time.Time }

func (f *fakeClock) now() time.Time          { return f.t }
func (f *fakeClock) advance(d time.Duration) { f.t = f.t.Add(d) }

func newTestLimiter(max int, window time.Duration) (*RateLimiter, *fakeClock) {
	clock := &fakeClock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	l := NewRateLimiter(max, window)
	l.now = clock.now
	l.lastSweep = clock.t
	return l, clock
}

func TestRateLimiterSlidingWindow(t *testing.T) {
	l, clock := newTestLimiter(3, time.Minute)

	for i := 0; i < 3; i++ {
		if ok, _ := l.Allow("a"); !ok {
			t.Fatalf("event %d should be allowed", i+1)
		}
		clock.advance(10 * time.Second)
	}
	ok, wait := l.Allow("a")
	if ok {
		t.Fatal("fourth event inside the window must be rejected")
	}
	if wait <= 0 || wait > time.Minute {
		t.Fatalf("retryAfter = %v, want within (0, 1m]", wait)
	}

	// The oldest event leaves the window 30s from now.
	clock.advance(31 * time.Second)
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("should be allowed again once the oldest event expired")
	}
}

func TestRateLimiterKeysAreIndependent(t *testing.T) {
	l, _ := newTestLimiter(1, time.Minute)
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("a first")
	}
	if ok, _ := l.Allow("b"); !ok {
		t.Fatal("b must not be affected by a")
	}
	if ok, _ := l.Allow("a"); ok {
		t.Fatal("a second must be rejected")
	}
}

func TestRateLimiterRejectedEventsDoNotExtendTheBlock(t *testing.T) {
	l, clock := newTestLimiter(1, time.Minute)
	l.Allow("a")
	for i := 0; i < 20; i++ {
		clock.advance(2 * time.Second)
		l.Allow("a") // all rejected
	}
	// 40s have passed; a hammering client must be free 20s later, not 60s after the last attempt.
	clock.advance(21 * time.Second)
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("rejected attempts must not be recorded")
	}
}

func TestRateLimiterSweepsIdleKeys(t *testing.T) {
	l, clock := newTestLimiter(5, time.Minute)
	for i := 0; i < 100; i++ {
		l.Allow(strings.Repeat("k", i+1))
	}
	clock.advance(2 * time.Minute)
	l.Allow("fresh")

	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.hits) != 1 {
		t.Fatalf("expected idle keys to be swept, %d keys remain", len(l.hits))
	}
}

func serve(r *gin.Engine, method, path string, mut func(*http.Request)) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(`{}`))
	req.RemoteAddr = "203.0.113.7:4000"
	if mut != nil {
		mut(req)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestLimitMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	l, _ := newTestLimiter(2, time.Minute)
	r := gin.New()
	r.POST("/x", Limit(l, "x"), func(c *gin.Context) { c.Status(http.StatusNoContent) })

	for i := 0; i < 2; i++ {
		if w := serve(r, http.MethodPost, "/x", nil); w.Code != http.StatusNoContent {
			t.Fatalf("request %d: %d", i+1, w.Code)
		}
	}
	w := serve(r, http.MethodPost, "/x", nil)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("third request: %d, want 429", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Fatal("429 must carry Retry-After")
	}

	// A different client is unaffected.
	other := serve(r, http.MethodPost, "/x", func(req *http.Request) { req.RemoteAddr = "198.51.100.9:1" })
	if other.Code != http.StatusNoContent {
		t.Fatalf("other client: %d", other.Code)
	}
}

func TestLimitFailuresCountsOnlyFailures(t *testing.T) {
	gin.SetMode(gin.TestMode)
	l, _ := newTestLimiter(2, time.Minute)
	r := gin.New()
	r.POST("/login", LimitFailures(l, "login"), func(c *gin.Context) {
		if c.Query("pw") == "right" {
			c.Status(http.StatusOK)
			return
		}
		c.Status(http.StatusUnauthorized)
	})

	for i := 0; i < 10; i++ {
		if w := serve(r, http.MethodPost, "/login?pw=right", nil); w.Code != http.StatusOK {
			t.Fatalf("successful login %d should never be limited, got %d", i+1, w.Code)
		}
	}
	for i := 0; i < 2; i++ {
		if w := serve(r, http.MethodPost, "/login?pw=wrong", nil); w.Code != http.StatusUnauthorized {
			t.Fatalf("failure %d: %d", i+1, w.Code)
		}
	}
	// Locked out now — even the right password is refused until the window passes.
	if w := serve(r, http.MethodPost, "/login?pw=right", nil); w.Code != http.StatusTooManyRequests {
		t.Fatalf("after %d failures: %d, want 429", 2, w.Code)
	}
}

func TestLimitVisitorsSkipsAdmins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ti := auth.NewTokenIssuer(config.JWTConfig{Secret: strings.Repeat("s", 40), Issuer: "t", AccessExpireMin: 5})
	token, _, err := ti.Issue(uuid.New(), "root")
	if err != nil {
		t.Fatal(err)
	}
	hostKey := strings.Repeat("h", 40)

	l, _ := newTestLimiter(1, time.Minute)
	r := gin.New()
	r.POST("/q", auth.RequireAdminOrHost(ti), LimitVisitors(l, "q"), func(c *gin.Context) { c.Status(http.StatusNoContent) })

	asAdmin := func(req *http.Request) { req.Header.Set("Authorization", "Bearer "+token) }
	asHost := func(req *http.Request) { req.Header.Set(auth.HostKeyHeader, hostKey) }

	for i := 0; i < 5; i++ {
		if w := serve(r, http.MethodPost, "/q", asAdmin); w.Code != http.StatusNoContent {
			t.Fatalf("admin request %d throttled: %d", i+1, w.Code)
		}
	}
	if w := serve(r, http.MethodPost, "/q", asHost); w.Code != http.StatusNoContent {
		t.Fatalf("first host request: %d", w.Code)
	}
	if w := serve(r, http.MethodPost, "/q", asHost); w.Code != http.StatusTooManyRequests {
		t.Fatalf("second host request: %d, want 429", w.Code)
	}
}

func TestMaxBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/b", MaxBody(16), func(c *gin.Context) {
		var v map[string]any
		if err := c.ShouldBindJSON(&v); err != nil {
			c.Status(http.StatusBadRequest)
			return
		}
		c.Status(http.StatusNoContent)
	})

	small := httptest.NewRequest(http.MethodPost, "/b", strings.NewReader(`{"a":1}`))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, small)
	if w.Code != http.StatusNoContent {
		t.Fatalf("small body: %d", w.Code)
	}

	// A streamed body declares no length, so the reader's limit is what stops
	// it: binding fails instead of buffering the whole payload.
	big := httptest.NewRequest(http.MethodPost, "/b", strings.NewReader(`{"a":"`+strings.Repeat("x", 100)+`"}`))
	big.ContentLength = -1
	w = httptest.NewRecorder()
	r.ServeHTTP(w, big)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("oversized streamed body: %d, want 400", w.Code)
	}
}

func TestNormalizeIP(t *testing.T) {
	cases := map[string]string{
		"203.0.113.7":                   "203.0.113.7",
		"::ffff:203.0.113.7":            "203.0.113.7",
		"2001:db8:1:2:aaaa:bbbb:cccc:1": "2001:db8:1:2::/64",
		"2001:db8:1:2:1111:2222:3333:4": "2001:db8:1:2::/64",
		"2001:db8:1:3::1":               "2001:db8:1:3::/64",
		"not-an-ip":                     "not-an-ip",
		"":                              "",
	}
	for in, want := range cases {
		if got := normalizeIP(in); got != want {
			t.Errorf("normalizeIP(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestLimitTreatsAnIPv6PrefixAsOneClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	l, _ := newTestLimiter(2, time.Minute)
	r := gin.New()
	r.POST("/x", Limit(l, "x"), func(c *gin.Context) { c.Status(http.StatusNoContent) })

	from := func(addr string) int {
		return serve(r, http.MethodPost, "/x", func(req *http.Request) { req.RemoteAddr = addr }).Code
	}
	// Three different addresses in one /64 share a budget of two.
	if c := from("[2001:db8:1:2::1]:1"); c != http.StatusNoContent {
		t.Fatalf("first: %d", c)
	}
	if c := from("[2001:db8:1:2:dead:beef:1:2]:1"); c != http.StatusNoContent {
		t.Fatalf("second: %d", c)
	}
	if c := from("[2001:db8:1:2:ffff:ffff:ffff:ffff]:1"); c != http.StatusTooManyRequests {
		t.Fatalf("third in the same /64: %d, want 429", c)
	}
	// A different /64 is a different client.
	if c := from("[2001:db8:1:9::1]:1"); c != http.StatusNoContent {
		t.Fatalf("other /64: %d", c)
	}
}

func TestMaxBodyAnswers413ForADeclaredOversizeRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	called := false
	r.POST("/b", MaxBody(16), func(c *gin.Context) { called = true; c.Status(http.StatusNoContent) })

	req := httptest.NewRequest(http.MethodPost, "/b", strings.NewReader(strings.Repeat("x", 64)))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", w.Code)
	}
	if called {
		t.Fatal("the handler must not run for an oversized request")
	}
}
