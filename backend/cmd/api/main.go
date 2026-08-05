package main

import (
	"context"
	"log"

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
	adminUC := admin.NewAdminUseCase(adminRepo)
	// Auto-create admin for the user
	adminUC.Create(context.Background(), "husssein", "hussein")
	adminUC.Create(context.Background(), "hussein", "hussein")
	adminUC.Create(context.Background(), "admin", "admin")
	quizUC := quiz.NewQuizUseCase(quizRepo)
	quizQuestionUC := quiz.NewQuizQuestionUseCase(quizRepo, quizQuestionRepo)
	formUC := form.NewFormUseCase(formRepo)
	formFieldUC := form_field_uc.NewFormFieldUseCase(formRepo, formFieldRepo)
	responseUC := response.NewResponseUsecase(formRepo, formFieldRepo, responseRepo, responseAnswerRepo, responseAnswerVectorRepo)
	
	geminiSvc := services.NewGeminiService(db.Pool())

	// Create hub for WS
	hub := ws.NewHub()
	go hub.Run()

	quizSessionUC := quiz.NewQuizSessionUseCase(quizRepo, quizQuestionRepo, quizSessionRepo)
	quizPlayerUC := quiz.NewQuizPlayerUseCase(quizSessionRepo, quizPlayerRepo)
	quizAnswerUC := quiz.NewQuizAnswerUseCase(quizSessionRepo, quizQuestionRepo, quizPlayerRepo, quizPlayerAnswerRepo)

	// 6. Handlers
	adminHandler := handlers.NewAdminHandler(adminUC)
	quizHandler := handlers.NewQuizHandler(quizUC, quizQuestionUC)
	sessionHandler := handlers.NewQuizSessionHandler(quizSessionUC, quizPlayerUC, hub)
	wsHandler := handlers.NewQuizWSHandler(hub, quizPlayerUC, quizAnswerUC, quizSessionUC)
	formHandler := handlers.NewFormHandler(formUC)
	formFieldHandler := handlers.NewFormFieldHandler(formFieldUC)
	responseHandler := handlers.NewResponseHandler(responseUC)
	homepageHandler := handlers.NewHomepageHandler(db.Pool())
	geminiHandler := handlers.NewGeminiHandler(geminiSvc)

	// 7. Gin Setup
	if cfg.Server.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Serve static uploads for the CMS images
	r.Static("/uploads", "./uploads")

	// 8. Wire Routes
	server.SetupRoutes(r, adminHandler, quizHandler, sessionHandler, wsHandler, formHandler, formFieldHandler, responseHandler, homepageHandler, geminiHandler)

	// 9. Start server
	addr := cfg.Server.Address()
	log.Printf("Starting server on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
