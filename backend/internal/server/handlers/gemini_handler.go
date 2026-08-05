package handlers

import (
	"net/http"

	"skillture/backend/services"

	"github.com/gin-gonic/gin"
)

type GeminiHandler struct {
	geminiService *services.GeminiService
}

func NewGeminiHandler(geminiService *services.GeminiService) *GeminiHandler {
	return &GeminiHandler{geminiService: geminiService}
}

func (h *GeminiHandler) GenerateReport(c *gin.Context) {
	report, err := h.geminiService.GenerateReport(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"report": report})
}
