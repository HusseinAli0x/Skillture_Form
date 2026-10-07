package server

import (
	"testing"

	"skillture/backend/internal/auth"
	"skillture/backend/internal/server/handlers"

	"github.com/gin-gonic/gin"
)

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
