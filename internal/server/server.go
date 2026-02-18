package server

import (
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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
	r.SetTrustedProxies(nil)

	// Apply Middleware
	setupMiddleware(r)

	SetupRoutes(r, adminHandler, formHandler, fieldHandler, responseHandler)

	// Serve frontend static files in production
	serveStaticFiles(r)

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

// serveStaticFiles serves the React frontend build from ./web/dist.
// It falls back to index.html for SPA client-side routing.
// Only activates if the dist directory exists (no-op in dev mode).
func serveStaticFiles(r *gin.Engine) {
	distPath := "./web/dist"

	// Check if dist directory exists
	if _, err := os.Stat(distPath); os.IsNotExist(err) {
		log.Println("No frontend dist found, skipping static file serving")
		return
	}

	absPath, _ := filepath.Abs(distPath)
	log.Printf("Serving frontend from %s", absPath)

	fileServer := http.FileServer(http.Dir(distPath))

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// Skip API routes
		if strings.HasPrefix(path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "endpoint not found"})
			return
		}

		// Try to serve the exact file
		fullPath := filepath.Join(distPath, path)
		if _, err := fs.Stat(os.DirFS(distPath), strings.TrimPrefix(path, "/")); err == nil {
			_ = fullPath // suppress unused
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		// SPA fallback: serve index.html for client-side routing
		c.File(filepath.Join(distPath, "index.html"))
	})
}
