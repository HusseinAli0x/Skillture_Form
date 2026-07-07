package server

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// setupMiddleware configures global middlewares for the router.
func setupMiddleware(r *gin.Engine) {
	// CORS — allow all origins in development; restrict in production
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// TODO: Add JWT authentication middleware here
}

// AdminLoggingMiddleware logs every request that reaches an admin route.
func AdminLoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Printf("[ADMIN] %s %s — %d (%s)",
			c.Request.Method,
			c.Request.URL.Path,
			c.Writer.Status(),
			time.Since(start),
		)
	}
}
