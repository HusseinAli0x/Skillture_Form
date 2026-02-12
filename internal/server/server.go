package server

import (
	"log"
	"os"

	"Skillture_Form/internal/server/handlers"

	"github.com/gin-gonic/gin"
)

// Server represents the HTTP server
type Server struct {
	router *gin.Engine
}

// NewServer creates a new server instance with wired handlers
func NewServer(
	adminHandler *handlers.AdminHandler,
	formHandler *handlers.FormHandler,
	fieldHandler *handlers.FormFieldHandler,
	responseHandler *handlers.ResponseHandler,
) *Server {

	r := gin.Default()

	// Apply Middleware (CORS, etc.) if needed
	// r.Use(corsMiddleware())

	SetupRoutes(r, adminHandler, formHandler, fieldHandler, responseHandler)

	return &Server{
		router: r,
	}
}

// Run starts the server
func (s *Server) Run() error {
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on port %s", port)
	return s.router.Run(":" + port)
}
