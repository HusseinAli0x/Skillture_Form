package server

import (
	"Skillture_Form/internal/server/handlers"

	"github.com/gin-gonic/gin"
)

// import (
// 	"Skillture_Form/internal/server/handlers"

// 	"github.com/gin-gonic/gin"
// )

// // setupRoutes configures all route groups and endpoints
// func setupRoutes(r *gin.Engine) {
// 	// Admin group routes
// 	adminGroup := r.Group("/admin")
// 	{
// 		adminGroup.GET("/", handlers.AdminListHandler)    // GET /admin
// 		adminGroup.POST("/", handlers.AdminCreateHandler) // POST /admin
// 	}

// 	// TODO: Add more route groups (forms, responses, etc.)
// }

// SetupRoutes configures all route groups and endpoints
func SetupRoutes(
	r *gin.Engine,
	adminHandler *handlers.AdminHandler,
	formHandler *handlers.FormHandler,
	fieldHandler *handlers.FormFieldHandler,
	responseHandler *handlers.ResponseHandler,
) {
	// API v1 group
	v1 := r.Group("/api/v1")

	// Admin routes
	admin := v1.Group("/admins")
	{
		admin.POST("/", adminHandler.Create)
		admin.POST("/login", adminHandler.LoginAdmin) // Added based on AdminHandler
		admin.GET("/", adminHandler.List)
		admin.GET("/:id", adminHandler.GetByID)
		admin.DELETE("/:id", adminHandler.Delete)
	}

	// Form routes
	forms := v1.Group("/forms")
	{
		forms.POST("/", formHandler.Create)
		forms.GET("/", formHandler.List)
		forms.GET("/:id", formHandler.GetByID)
		forms.PUT("/:id", formHandler.Update)
		forms.DELETE("/:id", formHandler.Delete)

		// Form actions
		forms.POST("/:id/publish", formHandler.Publish)
		forms.POST("/:id/close", formHandler.Close)

		// Nested fields routes
		forms.GET("/:id/fields", fieldHandler.ListByFormID)
		forms.GET("/:id/responses", responseHandler.ListByForm)
	}

	// Field routes (independent management)
	fields := v1.Group("/fields")
	{
		fields.POST("/", fieldHandler.Create) // Payload contains form_id
		fields.PUT("/:id", fieldHandler.Update)
		fields.DELETE("/:id", fieldHandler.Delete)
	}

	// Response routes
	responses := v1.Group("/responses")
	{
		responses.POST("/", responseHandler.Submit)
		responses.GET("/:id", responseHandler.GetByID)
		responses.DELETE("/:id", responseHandler.Delete)
	}
}
