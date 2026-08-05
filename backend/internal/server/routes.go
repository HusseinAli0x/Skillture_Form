package server

import (
	"net/http"

	"skillture/backend/internal/server/handlers"

	"github.com/gin-gonic/gin"
)

// HealthCheck is a simple liveness probe.
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// SetupRoutes registers all application routes on the given Gin engine.
func SetupRoutes(
	r *gin.Engine,
	adminHandler *handlers.AdminHandler,
	quizHandler *handlers.QuizHandler,
	sessionHandler *handlers.QuizSessionHandler,
	wsHandler *handlers.QuizWSHandler,
	formHandler *handlers.FormHandler,
	formFieldHandler *handlers.FormFieldHandler,
	responseHandler *handlers.ResponseHandler,
	homepageHandler *handlers.HomepageHandler,
	geminiHandler *handlers.GeminiHandler,
) {
	// ---- Liveness probe ----
	r.GET("/health", HealthCheck)

	// ---- Admin routes ----
	admin := r.Group("/admin")
	admin.Use(AdminLoggingMiddleware())
	{
		admin.POST("/create", adminHandler.CreateAdmin)
		admin.GET("/list", adminHandler.ListAdmins)
		admin.DELETE("/delete/:id", adminHandler.DeleteAdmin)
		admin.POST("/login", adminHandler.LoginAdmin)
	}

	// ---- Public Homepage routes ----
	api := r.Group("/api/v1")
	{
		homepage := api.Group("/homepage")
		{
			homepage.GET("", homepageHandler.GetContent)
			homepage.PUT("", homepageHandler.UpdateContent)
			homepage.POST("/images", homepageHandler.UploadImage)
			homepage.GET("/images", homepageHandler.GetImages)
		}
		
		adminApi := api.Group("/admin")
		{
			adminApi.GET("/ai-report", geminiHandler.GenerateReport)
		}
		// Quiz CRUD
		quizzes := api.Group("/quizzes")
		{
			quizzes.POST("", quizHandler.Create)
			quizzes.GET("", quizHandler.List)
			quizzes.GET("/:id", quizHandler.GetByID)
			quizzes.PUT("/:id", quizHandler.Update)
			quizzes.PATCH("/:id/activate", quizHandler.Activate)
			quizzes.PATCH("/:id/archive", quizHandler.Archive)
			quizzes.DELETE("/:id", quizHandler.Delete)

			// Nested question management
			quizzes.POST("/:id/questions", quizHandler.CreateQuestion)
			quizzes.GET("/:id/questions", quizHandler.ListQuestions)
			quizzes.PUT("/:id/questions/:qid", quizHandler.UpdateQuestion)
			quizzes.DELETE("/:id/questions/:qid", quizHandler.DeleteQuestion)

			// Create a live session for a quiz
			quizzes.POST("/:id/sessions", sessionHandler.CreateSession)
			// Get the active session for a quiz
			quizzes.GET("/:id/active-session", sessionHandler.GetActiveSession)
		}

		// Form CRUD
		forms := api.Group("/forms")
		{
			forms.POST("", formHandler.Create)
			forms.GET("", formHandler.List)
			forms.GET("/:id", formHandler.GetByID)
			forms.PUT("/:id", formHandler.Update)
			forms.DELETE("/:id", formHandler.Delete)

			// Form Field management
			forms.POST("/:id/fields", formFieldHandler.Create)
			forms.GET("/:id/fields", formFieldHandler.ListByFormID)
			forms.PUT("/:id/fields/:fieldID", formFieldHandler.Update)
			forms.DELETE("/:id/fields/:fieldID", formFieldHandler.Delete)
		}

		// Responses
		responses := api.Group("/responses")
		{
			responses.POST("", responseHandler.Submit)
			responses.GET("/:id", responseHandler.GetByID)
			responses.GET("/:id/answers", responseHandler.GetAnswers)
			responses.DELETE("/:id", responseHandler.Delete)
		}
		// List responses by form
		api.GET("/forms/:id/responses", responseHandler.ListByForm)
		api.GET("/forms/:id/responses/detailed", responseHandler.ListDetailedByForm)

		// Session management (host-driven state machine)
		sessions := api.Group("/sessions")
		{
			sessions.GET("/:id", sessionHandler.GetSession)
			sessions.GET("/pin/:pin", sessionHandler.GetByPIN)
			sessions.PATCH("/:id/start", sessionHandler.StartSession)
			sessions.PATCH("/:id/advance", sessionHandler.AdvanceQuestion)
			sessions.PATCH("/:id/finish", sessionHandler.FinishSession)
			sessions.GET("/:id/leaderboard", sessionHandler.GetLeaderboard)

			// Player join (REST): returns player record with ID used for WS connect
			sessions.POST("/:id/players", wsHandler.JoinSession)

			// Player answer submission (REST + triggers WS leaderboard broadcast)
			sessions.POST("/:id/answer", wsHandler.SubmitAnswer)
		}
	}

	// ---- WebSocket upgrades ----
	// WS endpoints live outside /api/v1 to avoid confusion with REST
	wsGroup := r.Group("/ws")
	{
		wsGroup.GET("/sessions/:id/host", wsHandler.ConnectHost)
		wsGroup.GET("/sessions/:id/join", wsHandler.ConnectPlayer)
	}
}

