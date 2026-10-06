package main

import (
	"context"
	"log"

	"skillture/backend/internal/auth"
	"skillture/backend/internal/config"
	"skillture/backend/internal/database"
	"skillture/backend/internal/repository/postgres"
	"skillture/backend/internal/server"
	"skillture/backend/internal/server/handlers"
	"skillture/backend/internal/server/ws"
	"skillture/backend/services"

	"skillture/backend/internal/usecase/admin"
	"skillture/backend/internal/usecase/form"
	form_field_uc "skillture/backend/internal/usecase/form_field"
	"skillture/backend/internal/usecase/quiz"
	"skillture/backend/internal/usecase/response"

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 2. Connect DB
	db, err := database.New(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// 2b. Apply schema migrations.
	//
	// The schema used to be mounted into docker-entrypoint-initdb.d, which
	// only runs on an empty data volume, so every change meant
	// `docker compose down -v` and total data loss. Migrations are embedded in
	// the binary and applied here, under a Postgres advisory lock so two
	// replicas starting together cannot both apply the same file.
	//
	// Fatal on failure by design: serving requests against a schema the code
	// does not expect is worse than not starting.
	if err := database.Migrate(context.Background(), db.Pool()); err != nil {
		log.Fatalf("Failed to apply migrations: %v", err)
	}

	// 3. Base Repository
	baseRepo := postgres.NewBaseRepository(db.Pool(), cfg.Database.QueryTimeout)

	// 4. Repositories
	adminRepo := postgres.NewAdminRepository(baseRepo)
	quizRepo := postgres.NewQuizRepository(baseRepo)
	quizQuestionRepo := postgres.NewQuizQuestionRepository(baseRepo)
	quizSessionRepo := postgres.NewQuizSessionRepository(baseRepo)
	quizPlayerRepo := postgres.NewQuizPlayerRepository(baseRepo)
	quizPlayerAnswerRepo := postgres.NewQuizPlayerAnswerRepository(baseRepo)
	formRepo := postgres.NewFormRepository(baseRepo)
	formFieldRepo := postgres.NewFormFieldRepository(baseRepo)
	responseRepo := postgres.NewResponseRepository(baseRepo)
	responseAnswerRepo := postgres.NewResponseAnswerRepository(baseRepo)
	responseAnswerVectorRepo := postgres.NewResponseAnswerVectorRepository(baseRepo)

	// 5. UseCases & Services
	//
	// NOTE: this used to unconditionally create the admins "admin"/"admin",
	// "hussein"/"hussein" and "husssein"/"hussein" on every process start —
	// a permanent backdoor that reappeared after any manual cleanup. The
	// initial account comes from the baseline migration's seed, which only
	// inserts when the admins table is empty.
	adminUC := admin.NewAdminUseCase(adminRepo, cfg.JWT.BcryptCost)
	quizUC := quiz.NewQuizUseCase(quizRepo)
	quizQuestionUC := quiz.NewQuizQuestionUseCase(quizRepo, quizQuestionRepo)
	formUC := form.NewFormUseCase(formRepo)
	formFieldUC := form_field_uc.NewFormFieldUseCase(formRepo, formFieldRepo)
	responseUC := response.NewResponseUsecase(formRepo, formFieldRepo, responseRepo, responseAnswerRepo, responseAnswerVectorRepo)

	geminiSvc := services.NewGeminiService(db.Pool(), cfg.Gemini)

	// Token issuer for admin authentication
	tokens := auth.NewTokenIssuer(cfg.JWT)

	// Create hub for WS
	hub := ws.NewHub()
	go hub.Run()

	quizSessionUC := quiz.NewQuizSessionUseCase(quizRepo, quizQuestionRepo, quizSessionRepo)
	quizPlayerUC := quiz.NewQuizPlayerUseCase(quizSessionRepo, quizPlayerRepo)
	quizAnswerUC := quiz.NewQuizAnswerUseCase(quizSessionRepo, quizQuestionRepo, quizPlayerRepo, quizPlayerAnswerRepo)

	// 6. Handlers
	adminHandler := handlers.NewAdminHandler(adminUC, tokens)
	quizHandler := handlers.NewQuizHandler(quizUC, quizQuestionUC)
	sessionHandler := handlers.NewQuizSessionHandler(quizSessionUC, quizPlayerUC, hub)
	wsHandler := handlers.NewQuizWSHandler(hub, quizPlayerUC, quizAnswerUC, quizSessionUC, tokens, cfg.CORS)
	formHandler := handlers.NewFormHandler(formUC)
	formFieldHandler := handlers.NewFormFieldHandler(formFieldUC)
	responseHandler := handlers.NewResponseHandler(responseUC)
	homepageHandler := handlers.NewHomepageHandler(db.Pool(), cfg.Upload)
	geminiHandler := handlers.NewGeminiHandler(geminiSvc)
	workshopHandler := handlers.NewWorkshopHandler(db.Pool(), cfg.Upload)
	contactHandler := handlers.NewContactHandler(db.Pool())

	// 7. Gin Setup
	if cfg.Server.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Requests arrive through Caddy, so client IPs must come from the
	// configured trusted proxies rather than being taken on faith.
	if err := r.SetTrustedProxies(cfg.Security.TrustedProxies); err != nil {
		log.Fatalf("Failed to set trusted proxies: %v", err)
	}

	// Global middleware (CORS). This call was missing entirely, so nothing in
	// middleware.go ever executed.
	server.SetupMiddleware(r, cfg)

	// Serve static uploads for the CMS images
	r.Static("/uploads", "./uploads")

	// 8. Wire Routes
	server.SetupRoutes(r, tokens, adminHandler, quizHandler, sessionHandler, wsHandler, formHandler, formFieldHandler, responseHandler, homepageHandler, geminiHandler, workshopHandler, contactHandler)

	// 9. Start server
	addr := cfg.Server.Address()
	log.Printf("Starting server on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
