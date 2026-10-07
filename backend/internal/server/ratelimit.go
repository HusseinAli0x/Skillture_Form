package server

import (
	"net/http"
	"net/netip"
	"strconv"
	"sync"
	"time"

	"skillture/backend/internal/auth"

	"github.com/gin-gonic/gin"
)

// RateLimiter is a sliding-window limiter: at most `max` events per `window`
// for each key. It is in memory and per process, which is what this
// single-container deployment needs; running several API replicas would need
// a shared store.
//
// The configured RATE_LIMIT_* and MAX_LOGIN_ATTEMPTS settings used to be read
// and never enforced anywhere. Anything public that writes data (login,
// contact, registration, creating games) now goes through one of these.
type RateLimiter struct {
	mu        sync.Mutex
	hits      map[string][]time.Time
	max       int
	window    time.Duration
	now       func() time.Time
	lastSweep time.Time
}

// NewRateLimiter allows `max` events per `window` for each key.
func NewRateLimiter(max int, window time.Duration) *RateLimiter {
	l := &RateLimiter{hits: map[string][]time.Time{}, max: max, window: window, now: time.Now}
	l.lastSweep = l.now()
	return l
}

// prune drops timestamps that fell out of the window. Callers hold l.mu.
func (l *RateLimiter) prune(key string, now time.Time) []time.Time {
	cutoff := now.Add(-l.window)
	kept := l.hits[key]
	i := 0
	for i < len(kept) && !kept[i].After(cutoff) {
		i++
	}
	kept = kept[i:]
	if len(kept) == 0 {
		delete(l.hits, key)
		return nil
	}
	l.hits[key] = kept
	return kept
}

// sweep removes keys with no recent activity so the map cannot grow without
// bound under a stream of one-off addresses. Callers hold l.mu.
func (l *RateLimiter) sweep(now time.Time) {
	if now.Sub(l.lastSweep) < l.window {
		return
	}
	l.lastSweep = now
	for key := range l.hits {
		l.prune(key, now)
	}
}

// Allow records an event for key and reports whether it is within the limit.
// When it is not, retryAfter says how long until the oldest event expires.
// A rejected event is not recorded, so hammering a blocked endpoint does not
// extend the block.
func (l *RateLimiter) Allow(key string) (ok bool, retryAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.sweep(now)

	recent := l.prune(key, now)
	if len(recent) >= l.max {
		return false, recent[0].Add(l.window).Sub(now)
	}
	l.hits[key] = append(recent, now)
	return true, 0
}

// Blocked reports whether key is already at its limit, without recording an
// event. Used together with Record to count only failed attempts.
func (l *RateLimiter) Blocked(key string) (blocked bool, retryAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	recent := l.prune(key, now)
	if len(recent) >= l.max {
		return true, recent[0].Add(l.window).Sub(now)
	}
	return false, 0
}

// Record adds an event for key unconditionally.
func (l *RateLimiter) Record(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.sweep(now)
	l.hits[key] = append(l.prune(key, now), now)
}

// clientKey is what a client is counted as. IPv4 is the address itself. A home
// or mobile IPv6 customer is handed a whole /64 (2^64 addresses), so counting
// individual addresses would give an attacker a fresh budget per request; all
// of a /64 shares one.
func clientKey(c *gin.Context) string {
	return normalizeIP(c.ClientIP())
}

func normalizeIP(raw string) string {
	addr, err := netip.ParseAddr(raw)
	if err != nil {
		return raw
	}
	addr = addr.Unmap()
	if addr.Is6() {
		if prefix, err := addr.Prefix(64); err == nil {
			return prefix.String()
		}
	}
	return addr.String()
}

func tooManyRequests(c *gin.Context, retryAfter time.Duration) {
	secs := int(retryAfter.Seconds()) + 1
	c.Header("Retry-After", strconv.Itoa(secs))
	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
		"error":               "too many requests, please try again later",
		"retry_after_seconds": secs,
	})
}

// Limit rejects a request with 429 once the caller's IP has used up the
// limiter's budget for scope. Every request counts.
func Limit(l *RateLimiter, scope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if ok, wait := l.Allow(scope + ":" + clientKey(c)); !ok {
			tooManyRequests(c, wait)
			return
		}
		c.Next()
	}
}

// LimitVisitors is Limit for routes shared by admins and anonymous hosts: it
// only throttles visitors, so a signed-in admin is never slowed down. It must
// run after auth.RequireAdminOrHost.
func LimitVisitors(l *RateLimiter, scope string) gin.HandlerFunc {
	limit := Limit(l, scope)
	return func(c *gin.Context) {
		if p, ok := auth.PrincipalFromContext(c); ok && p.IsAdmin() {
			c.Next()
			return
		}
		limit(c)
	}
}

// LimitFailures counts only requests that end in 401 or 403 — failed logins —
// and blocks the caller's IP once it has accumulated the limiter's budget. A
// correct password never counts against anyone.
func LimitFailures(l *RateLimiter, scope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := scope + ":" + clientKey(c)
		if blocked, wait := l.Blocked(key); blocked {
			tooManyRequests(c, wait)
			return
		}
		c.Next()
		if s := c.Writer.Status(); s == http.StatusUnauthorized || s == http.StatusForbidden {
			l.Record(key)
		}
	}
}

// MaxBody caps the request body at n bytes: 413 when the declared size is over,
// and reading past it fails, so JSON binding returns an error instead of
// buffering an arbitrarily large payload.
func MaxBody(n int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		// A browser states the size up front, so an oversized request can be
		// refused with the right status (413) before anything is read; the
		// reader below still stops a client that lies or streams.
		if c.Request.ContentLength > n {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request too large"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, n)
		c.Next()
	}
}
