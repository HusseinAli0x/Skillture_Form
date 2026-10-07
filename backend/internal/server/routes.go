package server

import (
	"net/http"
	"time"

	"skillture/backend/internal/auth"
	"skillture/backend/internal/config"
	"skillture/backend/internal/server/handlers"

	"github.com/gin-gonic/gin"
)

// HealthCheck is a simple liveness probe.
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// SetupRoutes registers all application routes on the given Gin engine.
//
// Routes are split into three groups:
//
//   - Public: the landing page, form preview and submission, workshop
//     registration, and everything a quiz player needs (look up a session by
//     PIN, join, answer, connect the player socket). Players have no accounts,
//     so these cannot require a token. Public routes that write data are rate
//     limited per client IP.
//   - Host: creating and running quiz games. Open to anyone who presents a host
//     key (auth.RequireAdminOrHost); handlers then check that the quiz or
//     session belongs to the caller. Admins pass the same gate and may manage
//     every game.
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
	teamHandler *handlers.TeamHandler,
	siteHandler *handlers.SiteHandler,
	security config.SecurityConfig,
) {
	requireAdmin := auth.RequireAdmin(tokens)
	requireHost := auth.RequireAdminOrHost(tokens)

	// Per-IP budgets for public routes that write data. Sized for a classroom
	// sharing one address: a teacher's room of 40 students must not lock itself
	// out, while a script hammering an endpoint hits the wall quickly.
	loginFailures := NewRateLimiter(security.MaxLoginAttempts, security.LockoutDuration())
	contactLimit := NewRateLimiter(5, 10*time.Minute)
	registerLimit := NewRateLimiter(60, 10*time.Minute)
	pinLookupLimit := NewRateLimiter(120, time.Minute)
	joinLimit := NewRateLimiter(300, 10*time.Minute)
	quizCreateLimit := NewRateLimiter(20, time.Hour)
	questionSaveLimit := NewRateLimiter(120, 10*time.Minute)
	sessionCreateLimit := NewRateLimiter(30, time.Hour)
	quizEditLimit := NewRateLimiter(300, 10*time.Minute)
	ticketLimit := NewRateLimiter(60, time.Minute)
	wsJoinLimit := NewRateLimiter(2000, 10*time.Minute)

	const (
		smallBody  = 16 << 10  // sign-in, contact, registration, an answer
		avatarBody = 256 << 10 // joining a game: the avatar is a small inline image
		formBody   = 1 << 20   // a submitted form
		quizBody   = 64 << 10  // quiz title/description
		quizItems  = 512 << 10 // a full question list
	)

	// ---- Liveness probe ----
	r.GET("/health", HealthCheck)

	// ---- Admin account routes ----
	admin := r.Group("/admin")
	admin.Use(AdminLoggingMiddleware())
	{
		// Login is the only anonymous endpoint in this group.
		admin.POST("/login", MaxBody(smallBody), LimitFailures(loginFailures, "login"), adminHandler.LoginAdmin)

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
		api.GET("/workshops/past", workshopHandler.ListPast)
		api.GET("/workshops/:id", workshopHandler.GetByID)
		api.GET("/impact", workshopHandler.Impact)
		api.GET("/server-info", handlers.ServerInfo)
		api.GET("/team", teamHandler.List)
		api.POST("/contact", MaxBody(smallBody), Limit(contactLimit, "contact"), contactHandler.Submit)
		// Admin-edited wording, images and contact links, applied by the SPA.
		api.GET("/site", siteHandler.Get)
		// Anyone can register for an upcoming workshop with a name and email.
		api.POST("/workshops/:id/register", MaxBody(smallBody), Limit(registerLimit, "register"), workshopHandler.Register)

		// Respondents open a form by link and submit it without an account.
		api.GET("/forms/:id", formHandler.GetByID)
		api.GET("/forms/:id/fields", formFieldHandler.ListByFormID)
		api.POST("/responses", MaxBody(formBody), responseHandler.Submit)

		// Quiz players: find the session, join it, answer questions.
		api.GET("/sessions/pin/:pin", Limit(pinLookupLimit, "pin"), sessionHandler.GetByPIN)
		// The shared /quiz/:id link is opened by players, who have no account:
		// it must be public or the page can never find the session it waits for.
		// It reveals only the session (id, pin, status) of a quiz whose id the
		// caller already holds.
		api.GET("/quizzes/:id/active-session", sessionHandler.GetActiveSession)
		api.GET("/sessions/:id", sessionHandler.GetSession)
		api.GET("/sessions/:id/leaderboard", sessionHandler.GetLeaderboard)
		api.POST("/sessions/:id/players", MaxBody(avatarBody), Limit(joinLimit, "join"), wsHandler.JoinSession)
		api.POST("/sessions/:id/answer", MaxBody(smallBody), wsHandler.SubmitAnswer)
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

			// Who signed up. The export is a CSV for spreadsheets.
			workshops.GET("/:id/registrations", workshopHandler.ListRegistrations)
			workshops.GET("/:id/registrations.csv", workshopHandler.ExportRegistrations)
			workshops.DELETE("/:id/registrations/:rid", workshopHandler.DeleteRegistration)
		}

		// Site content: wording, images, contact links. Public read is above.
		site := authed.Group("/admin/site")
		{
			site.PUT("/text", siteHandler.UpdateText)
			site.PUT("/settings", siteHandler.UpdateSettings)
			site.PUT("/images/:slot", siteHandler.UpdateImage)
			site.POST("/image", siteHandler.UploadImage)
		}

		// Team CRUD (admin) — public read is above, unauthenticated.
		team := authed.Group("/admin/team")
		{
			team.POST("", teamHandler.Create)
			team.PUT("/:id", teamHandler.Update)
			team.DELETE("/:id", teamHandler.Delete)
			team.POST("/image", teamHandler.UploadImage)
		}

		// Contact form submissions (admin inbox) — public submit is above.
		contact := authed.Group("/admin/contact")
		{
			contact.GET("", contactHandler.List)
			contact.DELETE("/:id", contactHandler.Delete)
		}

		// AI analytics
		authed.GET("/admin/ai-report", geminiHandler.GenerateReport)

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

	}

	// =====================================================
	//  Host routes — admin token or host key
	// =====================================================
	// Anyone can build and run a game. The gate only establishes who is
	// calling; every handler here checks that the quiz or session is theirs
	// (handlers.QuizAccess), so a visitor never reaches another host's answers.
	hosts := api.Group("")
	hosts.Use(requireHost)
	{
		// Quiz CRUD
		quizzes := hosts.Group("/quizzes")
		{
			quizzes.POST("", MaxBody(quizBody), LimitVisitors(quizCreateLimit, "quiz-create"), quizHandler.Create)
			quizzes.GET("", quizHandler.List)
			quizzes.GET("/:id", quizHandler.GetByID)
			quizzes.PUT("/:id", MaxBody(quizBody), LimitVisitors(quizEditLimit, "quiz-edit"), quizHandler.Update)
			quizzes.PATCH("/:id/activate", quizHandler.Activate)
			quizzes.PATCH("/:id/archive", quizHandler.Archive)
			quizzes.DELETE("/:id", quizHandler.Delete)

			// Nested question management. These carry correct_answer, so they
			// must never be reachable by a player.
			quizzes.POST("/:id/questions", MaxBody(quizBody), LimitVisitors(quizEditLimit, "quiz-edit"), quizHandler.CreateQuestion)
			quizzes.GET("/:id/questions", quizHandler.ListQuestions)
			// Whole-list replace, in one transaction. This is what the builder
			// saves through; the per-question routes remain for scripted use.
			quizzes.PUT("/:id/questions", MaxBody(quizItems), LimitVisitors(questionSaveLimit, "question-save"), quizHandler.ReplaceQuestions)
			quizzes.PUT("/:id/questions/:qid", MaxBody(quizBody), LimitVisitors(quizEditLimit, "quiz-edit"), quizHandler.UpdateQuestion)
			quizzes.DELETE("/:id/questions/:qid", quizHandler.DeleteQuestion)

			// Session lifecycle
			quizzes.POST("/:id/sessions", LimitVisitors(sessionCreateLimit, "session-create"), sessionHandler.CreateSession)
		}

		// Host-driven session state machine
		sessions := hosts.Group("/sessions")
		{
			sessions.PATCH("/:id/start", sessionHandler.StartSession)
			sessions.PATCH("/:id/advance", MaxBody(smallBody), sessionHandler.AdvanceQuestion)
			sessions.PATCH("/:id/finish", sessionHandler.FinishSession)
			sessions.POST("/:id/show_results", sessionHandler.PublishResults)
			// One-minute, single-use ticket for the host WebSocket.
			sessions.POST("/:id/ws-ticket", LimitVisitors(ticketLimit, "ws-ticket"), sessionHandler.WSTicket)
		}
	}

	// ---- WebSocket upgrades ----
	// WS endpoints live outside /api/v1 to avoid confusion with REST.
	// Browsers cannot set an Authorization header on a WebSocket handshake, so
	// the host socket takes a one-minute, single-use ticket (issued by
	// POST /sessions/:id/ws-ticket) as a query parameter and redeems it inside
	// the handler. A ticket is safe to appear in logs; a token or key is not.
	wsGroup := r.Group("/ws")
	{
		wsGroup.GET("/sessions/:id/host", wsHandler.ConnectHost)
		// Generous (a classroom reconnecting after a wifi blip must not be
		// refused) but finite: each socket costs the server two goroutines.
		wsGroup.GET("/sessions/:id/join", Limit(wsJoinLimit, "ws-join"), wsHandler.ConnectPlayer)
	}
}
