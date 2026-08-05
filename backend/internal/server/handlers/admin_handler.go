package handlers

import (
	"log"
	"net/http"

	"skillture/backend/internal/usecase/admin"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AdminHandler handles admin-related HTTP requests
type AdminHandler struct {
	adminUC *admin.AdminUseCase
}

// NewAdminHandler creates a new AdminHandler instance
func NewAdminHandler(adminUC *admin.AdminUseCase) *AdminHandler {
	return &AdminHandler{adminUC: adminUC}
}

// Health is a simple endpoint to check server status
func (h *AdminHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "admin ok"})
}

// CreateAdmin handles creating a new admin
func (h *AdminHandler) CreateAdmin(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	admin, err := h.adminUC.Create(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":       admin.ID,
		"username": admin.Username,
		"created":  admin.CreatedAt,
	})
}

// ListAdmins handles listing all admins
func (h *AdminHandler) ListAdmins(c *gin.Context) {
	admins, err := h.adminUC.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var res []gin.H
	for _, a := range admins {
		res = append(res, gin.H{
			"id":       a.ID,
			"username": a.Username,
			"created":  a.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, res)
}

// DeleteAdmin handles removing an admin by ID
func (h *AdminHandler) DeleteAdmin(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.adminUC.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// LoginAdmin authenticates an admin and returns a simple response
func (h *AdminHandler) LoginAdmin(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	admin, err := h.adminUC.Authenticate(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		log.Printf("Login failed for user %s: %v", req.Username, err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// TODO: issue JWT token here
	c.JSON(http.StatusOK, gin.H{
		"token": "dummy-token-123",
		"admin": gin.H{
			"id":       admin.ID,
			"username": admin.Username,
		},
	})
}
