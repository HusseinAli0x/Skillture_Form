package handlers

import (
	"net/http"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminHandler struct {
	adminUC interfaces.AdminUseCase
}

func NewAdminHandler(adminUC interfaces.AdminUseCase) *AdminHandler {
	return &AdminHandler{
		adminUC: adminUC,
	}
}

// Create handles admin creation
func (h *AdminHandler) Create(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	admin := &entities.Admin{
		Username:       req.Username,
		HashedPassword: req.Password, // UC will hash it
	}

	if err := h.adminUC.Create(c.Request.Context(), admin); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, admin)
}

// List handles listing all admins
func (h *AdminHandler) List(c *gin.Context) {
	admins, err := h.adminUC.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, admins)
}

// GetByID handles getting admin by ID
func (h *AdminHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid UUID format"})
		return
	}

	admin, err := h.adminUC.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if admin == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "admin not found"})
		return
	}

	c.JSON(http.StatusOK, admin)
}

// Delete handles removing an admin
func (h *AdminHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid UUID format"})
		return
	}

	if err := h.adminUC.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// TODO: issue JWT token here
	c.JSON(http.StatusOK, gin.H{
		"id":       admin.ID,
		"username": admin.Username,
	})
}
