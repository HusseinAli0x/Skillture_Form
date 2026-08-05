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
	)

	want := map[string]string{
		"PUT /api/v1/forms/:id/fields":          "bulk field replace (D13)",
		"PUT /api/v1/quizzes/:id/questions":     "bulk question replace (D13)",
		"POST /api/v1/forms/:id/fields":         "single field create",
		"PUT /api/v1/forms/:id/fields/:fieldID": "single field update",
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
