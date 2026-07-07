package main

import (
	"log"

	"Skillture_Form/internal/config"
	"Skillture_Form/internal/database"
	"Skillture_Form/internal/repository/postgres"
	"Skillture_Form/internal/server"
	"Skillture_Form/internal/server/handlers"
	"Skillture_Form/internal/server/ws"

	"Skillture_Form/internal/usecase/admin"
	"Skillture_Form/internal/usecase/form"
	"Skillture_Form/internal/usecase/form_field"
	"Skillture_Form/internal/usecase/quiz"

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

	// 5. UseCases
	adminUC := admin.NewAdminUseCase(adminRepo)
	quizUC := quiz.NewQuizUseCase(quizRepo)
	quizQuestionUC := quiz.NewQuizQuestionUseCase(quizRepo, quizQuestionRepo)
	formUC := form.NewFormUseCase(formRepo)
	formFieldUC := form_field.NewFormFieldUseCase(formRepo, formFieldRepo)
	
	// Create hub for WS
	hub := ws.NewHub()
	go hub.Run()

	quizSessionUC := quiz.NewQuizSessionUseCase(quizRepo, quizQuestionRepo, quizSessionRepo)
	quizPlayerUC := quiz.NewQuizPlayerUseCase(quizSessionRepo, quizPlayerRepo)
	quizAnswerUC := quiz.NewQuizAnswerUseCase(quizSessionRepo, quizQuestionRepo, quizPlayerRepo, quizPlayerAnswerRepo)

	// 6. Handlers
	adminHandler := handlers.NewAdminHandler(adminUC)
	quizHandler := handlers.NewQuizHandler(quizUC, quizQuestionUC)
	sessionHandler := handlers.NewQuizSessionHandler(quizSessionUC, quizPlayerUC)
	wsHandler := handlers.NewQuizWSHandler(hub, quizPlayerUC, quizAnswerUC, quizSessionUC)
	formHandler := handlers.NewFormHandler(formUC)
	formFieldHandler := handlers.NewFormFieldHandler(formFieldUC)

	// 7. Gin Setup
	if cfg.Server.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	
	r := gin.Default()

	// 8. Wire Routes (Includes Form and FormField handlers)
	server.SetupRoutes(r, adminHandler, quizHandler, sessionHandler, wsHandler, formHandler, formFieldHandler)

	// 9. Start server
	addr := cfg.Server.Address()
	log.Printf("Starting server on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
