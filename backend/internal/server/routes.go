package server

import (
	"net/http"

	"skillture/backend/internal/auth"
	"skillture/backend/internal/server/handlers"

	"github.com/gin-gonic/gin"
)

// HealthCheck is a simple liveness probe.
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// SetupRoutes registers all application routes on the given Gin engine.
//
// Routes are split into two groups:
//
//   - Public: the landing page, form preview and submission, and everything a
//     quiz player needs (look up a session by PIN, join, answer, connect the
//     player socket). Players have no accounts, so these cannot require a token.
//   - Admin: everything else. Guarded by RequireAdmin. Before this split, every
//     route below was reachable anonymously, including admin creation, admin
//     deletion, and destructive form/quiz operations.
func SetupRoutes(
	r *gin.Engine,
	tokens *auth.TokenIssuer,
	adminHandler *handlers.AdminHandler,
	quizHandler *handlers.QuizHandler,
	sessionHandler *handlers.QuizSessionHandler,
	wsHandler *handlers.QuizWSHandler,
	formHandler *handlers.FormHandler,
	formFieldHandler *handlers.FormFieldHandler,
	responseHandler *handlers.ResponseHandler,
	homepageHandler *handlers.HomepageHandler,
	geminiHandler *handlers.GeminiHandler,
	workshopHandler *handlers.WorkshopHandler,
	contactHandler *handlers.ContactHandler,
) {
	requireAdmin := auth.RequireAdmin(tokens)

	// ---- Liveness probe ----
	r.GET("/health", HealthCheck)

	// ---- Admin account routes ----
	admin := r.Group("/admin")
	admin.Use(AdminLoggingMiddleware())
	{
		// Login is the only anonymous endpoint in this group.
		admin.POST("/login", adminHandler.LoginAdmin)

		protected := admin.Group("")
		protected.Use(requireAdmin)
		{
			protected.GET("/me", adminHandler.Me)
			protected.POST("/create", adminHandler.CreateAdmin)
			protected.GET("/list", adminHandler.ListAdmins)
			protected.DELETE("/delete/:id", adminHandler.DeleteAdmin)
		}
	}

	api := r.Group("/api/v1")

	// =====================================================
	//  Public routes — no authentication
	// =====================================================
	{
		// Landing page content is read by anonymous visitors.
		api.GET("/homepage", homepageHandler.GetContent)
		api.GET("/homepage/images", homepageHandler.GetImages)
		api.GET("/workshops", workshopHandler.ListUpcoming)
		api.POST("/contact", contactHandler.Submit)

		// Respondents open a form by link and submit it without an account.
		api.GET("/forms/:id", formHandler.GetByID)
		api.GET("/forms/:id/fields", formFieldHandler.ListByFormID)
		api.POST("/responses", responseHandler.Submit)

		// Quiz players: find the session, join it, answer questions.
		api.GET("/sessions/pin/:pin", sessionHandler.GetByPIN)
		api.GET("/sessions/:id", sessionHandler.GetSession)
		api.GET("/sessions/:id/leaderboard", sessionHandler.GetLeaderboard)
		api.POST("/sessions/:id/players", wsHandler.JoinSession)
		api.POST("/sessions/:id/answer", wsHandler.SubmitAnswer)
	}

	// =====================================================
	//  Admin routes — bearer token required
	// =====================================================
	authed := api.Group("")
	authed.Use(requireAdmin)
	{
		// CMS
		authed.PUT("/homepage", homepageHandler.UpdateContent)
		authed.POST("/homepage/images", homepageHandler.UploadImage)
		authed.PUT("/homepage/facts", homepageHandler.UpdateFacts)
		authed.PUT("/homepage/pillars", homepageHandler.UpdatePillars)

		// Workshops CRUD (admin) — public read is above, unauthenticated.
		workshops := authed.Group("/admin/workshops")
		{
			workshops.GET("", workshopHandler.ListAll)
			workshops.POST("", workshopHandler.Create)
			workshops.PUT("/:id", workshopHandler.Update)
			workshops.DELETE("/:id", workshopHandler.Delete)
			workshops.POST("/image", workshopHandler.UploadImage)
		}

		// Contact form submissions (admin inbox) — public submit is above.
		contact := authed.Group("/admin/contact")
		{
			contact.GET("", contactHandler.List)
			contact.DELETE("/:id", contactHandler.Delete)
		}

		// AI analytics
		authed.GET("/admin/ai-report", geminiHandler.GenerateReport)

		// Quiz CRUD
		quizzes := authed.Group("/quizzes")
		{
			quizzes.POST("", quizHandler.Create)
			quizzes.GET("", quizHandler.List)
			quizzes.GET("/:id", quizHandler.GetByID)
			quizzes.PUT("/:id", quizHandler.Update)
			quizzes.PATCH("/:id/activate", quizHandler.Activate)
			quizzes.PATCH("/:id/archive", quizHandler.Archive)
			quizzes.DELETE("/:id", quizHandler.Delete)

			// Nested question management. These carry correct_answer, so they
			// must never be reachable by a player.
			quizzes.POST("/:id/questions", quizHandler.CreateQuestion)
			quizzes.GET("/:id/questions", quizHandler.ListQuestions)
			// Whole-list replace, in one transaction. This is what the builder
			// saves through; the per-question routes remain for scripted use.
			quizzes.PUT("/:id/questions", quizHandler.ReplaceQuestions)
			quizzes.PUT("/:id/questions/:qid", quizHandler.UpdateQuestion)
			quizzes.DELETE("/:id/questions/:qid", quizHandler.DeleteQuestion)

			// Session lifecycle
			quizzes.POST("/:id/sessions", sessionHandler.CreateSession)
			quizzes.GET("/:id/active-session", sessionHandler.GetActiveSession)
		}

		// Form CRUD
		forms := authed.Group("/forms")
		{
			forms.POST("", formHandler.Create)
			forms.GET("", formHandler.List)
			forms.PUT("/:id", formHandler.Update)
			forms.DELETE("/:id", formHandler.Delete)

			// State transitions. PUT no longer accepts a `status` field —
			// writing that column directly bypassed these rules entirely.
			forms.PATCH("/:id/publish", formHandler.Publish)
			forms.PATCH("/:id/close", formHandler.Close)

			forms.POST("/:id/fields", formFieldHandler.Create)
			// Whole-list replace, in one transaction. This is what the builder
			// saves through; the per-field routes remain for scripted use.
			forms.PUT("/:id/fields", formFieldHandler.ReplaceFields)
			forms.PUT("/:id/fields/:fieldID", formFieldHandler.Update)
			forms.DELETE("/:id/fields/:fieldID", formFieldHandler.Delete)

			// Response inspection
			forms.GET("/:id/responses", responseHandler.ListByForm)
			forms.GET("/:id/responses/detailed", responseHandler.ListDetailedByForm)
		}

		// Individual responses
		responses := authed.Group("/responses")
		{
			responses.GET("/:id", responseHandler.GetByID)
			responses.GET("/:id/answers", responseHandler.GetAnswers)
			responses.DELETE("/:id", responseHandler.Delete)
		}

		// Host-driven session state machine
		sessions := authed.Group("/sessions")
		{
			sessions.PATCH("/:id/start", sessionHandler.StartSession)
			sessions.PATCH("/:id/advance", sessionHandler.AdvanceQuestion)
			sessions.PATCH("/:id/finish", sessionHandler.FinishSession)
			sessions.POST("/:id/show_results", sessionHandler.PublishResults)
		}
	}

	// ---- WebSocket upgrades ----
	// WS endpoints live outside /api/v1 to avoid confusion with REST.
	// Browsers cannot set an Authorization header on a WebSocket handshake, so
	// the host socket takes the access token as a query parameter and verifies
	// it inside the handler.
	wsGroup := r.Group("/ws")
	{
		wsGroup.GET("/sessions/:id/host", wsHandler.ConnectHost)
		wsGroup.GET("/sessions/:id/join", wsHandler.ConnectPlayer)
	}
}
