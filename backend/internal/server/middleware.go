package server

import (
	"log"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"skillture/backend/internal/config"

	"github.com/gin-gonic/gin"
)

// SetupMiddleware configures global middlewares for the router.
//
// This used to be unexported and was never called from main, so neither CORS
// nor anything else in it ever ran.
func SetupMiddleware(r *gin.Engine, cfg *config.Config) {
	r.Use(CORS(cfg.CORS))
}

// CORS echoes back only origins on the configured allow-list.
//
// The previous implementation hardcoded `Access-Control-Allow-Origin: *` while
// also allowing the Authorization header, which lets any site on the internet
// drive the API with a stolen token. Origins now come from
// CORS_ALLOWED_ORIGINS.
func CORS(cfg config.CORSConfig) gin.HandlerFunc {
	allowAll := slices.Contains(cfg.AllowedOrigins, "*")

	methods := strings.Join(cfg.AllowedMethods, ", ")
	headers := strings.Join(cfg.AllowedHeaders, ", ")
	maxAge := strconv.Itoa(cfg.MaxAge)

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		switch {
		case origin == "":
			// Same-origin or non-browser client; no CORS headers needed.
		case allowAll:
			// Credentials cannot be combined with a wildcard origin, so echo
			// the caller's origin instead and mark the response as varying.
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		case slices.Contains(cfg.AllowedOrigins, origin):
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		default:
			// Origin not allowed: send no CORS headers. The browser blocks the
			// response; a preflight is answered with 403.
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.Next()
			return
		}

		c.Header("Access-Control-Allow-Methods", methods)
		c.Header("Access-Control-Allow-Headers", headers)
		c.Header("Access-Control-Max-Age", maxAge)
		if cfg.AllowCredentials {
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
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
