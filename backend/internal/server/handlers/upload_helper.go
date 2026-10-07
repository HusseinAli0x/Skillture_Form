package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"skillture/backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// saveImageUpload is the shared two-step image flow for admin-managed content
// (workshop covers and galleries, team photos): validate size, extension and
// real content type, store under ./uploads with a random name, and answer
// with the public path. The create/update payload then carries that path.
func saveImageUpload(c *gin.Context, uploadCfg config.UploadConfig) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Image file is required"})
		return
	}

	if maxBytes := uploadCfg.MaxSizeBytes(); file.Size > maxBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": fmt.Sprintf("file exceeds the %d MB limit", uploadCfg.MaxSizeMB),
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !uploadCfg.IsAllowedType(ext) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "unsupported file type; allowed: " + strings.Join(uploadCfg.AllowedTypes, ", "),
		})
		return
	}

	if err := verifyImageContent(file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uploadDir := "uploads"
	if err := os.MkdirAll(uploadDir, 0o750); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	filename := uuid.New().String() + ext
	filePath := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"file_path": "/" + filePath})
}
