package main

import (
	"context"
	"log"
	"os"

	"Skillture_Form/internal/repository/postgres"
	"Skillture_Form/internal/server"
	"Skillture_Form/internal/server/handlers"
	"Skillture_Form/internal/usecase/admin"
	"Skillture_Form/internal/usecase/form"
	"Skillture_Form/internal/usecase/form_field"
	"Skillture_Form/internal/usecase/response"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	// 1. Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL must be set")
	}

	// 2. Connect to Database
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Unable to ping database: %v", err)
	}
	log.Println("Connected to database")

	// 3. Initialize Repositories
	baseRepo := postgres.NewBaseRepository(pool, 5000000000) // 5s timeout

	adminRepo := postgres.NewAdminRepository(baseRepo)
	formRepo := postgres.NewFormRepository(baseRepo)
	fieldRepo := postgres.NewFormFieldRepository(baseRepo)
	responseRepo := postgres.NewResponseRepository(baseRepo)
	answerRepo := postgres.NewResponseAnswerRepository(baseRepo)
	vectorRepo := postgres.NewResponseAnswerVectorRepository(baseRepo)

	// 4. Initialize UseCases
	adminUC := admin.NewAdminUseCase(adminRepo)
	formUC := form.NewFormUseCase(formRepo)
	fieldUC := form_field.NewFormFieldUseCase(formRepo, fieldRepo)
	responseUC := response.NewResponseUsecase(formRepo, fieldRepo, responseRepo, answerRepo, vectorRepo)

	// 5. Initialize Handlers
	adminHandler := handlers.NewAdminHandler(adminUC)
	formHandler := handlers.NewFormHandler(formUC)
	fieldHandler := handlers.NewFormFieldHandler(fieldUC)
	responseHandler := handlers.NewResponseHandler(responseUC)

	// 6. Initialize and Run Server
	srv := server.NewServer(adminHandler, formHandler, fieldHandler, responseHandler)

	if err := srv.Run(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
