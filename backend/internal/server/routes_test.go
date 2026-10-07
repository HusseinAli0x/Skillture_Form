package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"skillture/backend/internal/auth"
	"skillture/backend/internal/config"
	"skillture/backend/internal/server/handlers"

	"github.com/gin-gonic/gin"
)

// buildRoutes registers every route against nil handlers. Registration only
// takes method values, and requests that the auth middleware rejects never
// reach a handler, so the router can be exercised without a database.
func buildRoutes(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	SetupRoutes(
		r,
		auth.NewTokenIssuer(config.JWTConfig{Secret: strings.Repeat("s", 40), Issuer: "t", AccessExpireMin: 5}),
		(*handlers.AdminHandler)(nil),
		(*handlers.QuizHandler)(nil),
		(*handlers.QuizSessionHandler)(nil),
		(*handlers.QuizWSHandler)(nil),
		(*handlers.FormHandler)(nil),
		(*handlers.FormFieldHandler)(nil),
		(*handlers.ResponseHandler)(nil),
		(*handlers.HomepageHandler)(nil),
		(*handlers.GeminiHandler)(nil),
		(*handlers.WorkshopHandler)(nil),
		(*handlers.ContactHandler)(nil),
		(*handlers.TeamHandler)(nil),
		(*handlers.SiteHandler)(nil),
		config.SecurityConfig{MaxLoginAttempts: 5, LockoutDurationMin: 15},
	)
	return r
}

const sampleHostKey = "abcdefghijklmnopqrstuvwxyz0123456789_-ABCDEFG"

// TestAdminOnlyRoutesRejectVisitors is the guard rail for opening the quiz
// builder to everyone: a host key must unlock the game routes and nothing else.
func TestAdminOnlyRoutesRejectVisitors(t *testing.T) {
	r := buildRoutes(t)
	const id = "00000000-0000-0000-0000-000000000001"

	adminOnly := []string{
		"GET /api/v1/admin/workshops",
		"POST /api/v1/admin/workshops",
		"PUT /api/v1/admin/workshops/" + id,
		"DELETE /api/v1/admin/workshops/" + id,
		"GET /api/v1/admin/workshops/" + id + "/registrations",
		"GET /api/v1/admin/workshops/" + id + "/registrations.csv",
		"DELETE /api/v1/admin/workshops/" + id + "/registrations/" + id,
		"POST /api/v1/admin/workshops/image",
		"PUT /api/v1/admin/site/text",
		"PUT /api/v1/admin/site/settings",
		"PUT /api/v1/admin/site/images/logo_full",
		"POST /api/v1/admin/site/image",
		"POST /api/v1/admin/team",
		"GET /api/v1/admin/contact",
		"GET /api/v1/admin/ai-report",
		"PUT /api/v1/homepage",
		"POST /api/v1/homepage/images",
		"POST /api/v1/forms",
		"GET /api/v1/forms",
		"DELETE /api/v1/forms/" + id,
		"GET /api/v1/forms/" + id + "/responses",
		"GET /api/v1/responses/" + id,
		"POST /admin/create",
		"GET /admin/list",
		"DELETE /admin/delete/" + id,
	}
	hostRoutes := []string{
		"POST /api/v1/quizzes",
		"GET /api/v1/quizzes",
		"GET /api/v1/quizzes/" + id,
		"PUT /api/v1/quizzes/" + id,
		"DELETE /api/v1/quizzes/" + id,
		"PATCH /api/v1/quizzes/" + id + "/activate",
		"GET /api/v1/quizzes/" + id + "/questions",
		"PUT /api/v1/quizzes/" + id + "/questions",
		"POST /api/v1/quizzes/" + id + "/sessions",
		"PATCH /api/v1/sessions/" + id + "/start",
		"PATCH /api/v1/sessions/" + id + "/advance",
		"PATCH /api/v1/sessions/" + id + "/finish",
		"POST /api/v1/sessions/" + id + "/show_results",
		"POST /api/v1/sessions/" + id + "/ws-ticket",
	}

	do := func(route string, headers map[string]string) int {
		method, path, _ := strings.Cut(route, " ")
		req := httptest.NewRequest(method, path, nil)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	for _, route := range append(append([]string{}, adminOnly...), hostRoutes...) {
		if code := do(route, nil); code != http.StatusUnauthorized {
			t.Errorf("%s without credentials: %d, want 401", route, code)
		}
	}
	for _, route := range adminOnly {
		if code := do(route, map[string]string{auth.HostKeyHeader: sampleHostKey}); code != http.StatusUnauthorized {
			t.Errorf("%s with only a host key: %d, want 401 (admin only)", route, code)
		}
	}
}

// TestSetupRoutes checks that every route registers without gin panicking.
//
// gin's router rejects conflicting path segments at registration time, not at
// request time — so a bad route definition takes the whole process down on
// boot rather than failing one endpoint. That matters here because the bulk
// endpoints sit directly above existing wildcards:
//
//	PUT /api/v1/forms/:id/fields          vs  PUT /api/v1/forms/:id/fields/:fieldID
//	PUT /api/v1/quizzes/:id/questions     vs  PUT /api/v1/quizzes/:id/questions/:qid
//
// The handlers are nil pointers: registration only takes the method values,
// and this test never dispatches a request.
func TestSetupRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	defer func() {
		if p := recover(); p != nil {
			t.Fatalf("route registration panicked: %v", p)
		}
	}()

	SetupRoutes(
		r,
		&auth.TokenIssuer{},
		(*handlers.AdminHandler)(nil),
		(*handlers.QuizHandler)(nil),
		(*handlers.QuizSessionHandler)(nil),
		(*handlers.QuizWSHandler)(nil),
		(*handlers.FormHandler)(nil),
		(*handlers.FormFieldHandler)(nil),
		(*handlers.ResponseHandler)(nil),
		(*handlers.HomepageHandler)(nil),
		(*handlers.GeminiHandler)(nil),
		(*handlers.WorkshopHandler)(nil),
		(*handlers.ContactHandler)(nil),
		(*handlers.TeamHandler)(nil),
		(*handlers.SiteHandler)(nil),
		config.SecurityConfig{MaxLoginAttempts: 5, LockoutDurationMin: 15},
	)

	want := map[string]string{
		"PUT /api/v1/forms/:id/fields":          "bulk field replace (D13)",
		"PUT /api/v1/quizzes/:id/questions":     "bulk question replace (D13)",
		"POST /api/v1/forms/:id/fields":         "single field create",
		"PUT /api/v1/forms/:id/fields/:fieldID": "single field update",
		// D4: these use-case methods had no routes at all, so the only way to
		// publish a form was the untyped `status` field on PUT, which bypassed
		// the state machine they enforce.
		"PATCH /api/v1/forms/:id/publish": "form publish (D4)",
		"PATCH /api/v1/forms/:id/close":   "form close (D4)",
		"GET /api/v1/workshops/past":      "Our Work: past workshops",
		"GET /api/v1/workshops/:id":       "workshop detail page",
		"GET /api/v1/impact":              "Our Work: impact numbers",
		"GET /api/v1/team":                "public Team page",
		"POST /api/v1/admin/team":         "admin team create",
		// The shared /quiz/:id link is opened by players with no account.
		"GET /api/v1/quizzes/:id/active-session": "public active-session lookup",

		// Public hosting, workshop registration and editable site content.
		"POST /api/v1/sessions/:id/ws-ticket":                   "host socket ticket",
		"POST /api/v1/workshops/:id/register":                   "public workshop registration",
		"GET /api/v1/admin/workshops/:id/registrations":         "admin registrant list",
		"GET /api/v1/admin/workshops/:id/registrations.csv":     "admin registrant export",
		"DELETE /api/v1/admin/workshops/:id/registrations/:rid": "admin registrant delete",
		"GET /api/v1/site":                                      "public site content",
		"PUT /api/v1/admin/site/text":                           "admin site text",
		"PUT /api/v1/admin/site/images/:slot":                   "admin site image slot",
		"PUT /api/v1/admin/site/settings":                       "admin site settings",
	}

	got := make(map[string]bool)
	for _, route := range r.Routes() {
		got[route.Method+" "+route.Path] = true
	}

	for route, what := range want {
		if !got[route] {
			t.Errorf("route not registered: %s (%s)", route, what)
		}
	}
}
