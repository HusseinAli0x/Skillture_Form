package handlers

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HomepageHandler struct {
	pool *pgxpool.Pool
}

func NewHomepageHandler(pool *pgxpool.Pool) *HomepageHandler {
	return &HomepageHandler{pool: pool}
}

func (h *HomepageHandler) GetContent(c *gin.Context) {
	var content struct {
		ID                 int    `json:"id"`
		HeroTitle          string `json:"hero_title"`
		HeroSubtitle       string `json:"hero_subtitle"`
		CTAPrimaryText     string `json:"cta_primary_text"`
		CTASecondaryText   string `json:"cta_secondary_text"`
	}

	err := h.pool.QueryRow(c.Request.Context(), `
		SELECT id, hero_title, hero_subtitle, cta_primary_text, cta_secondary_text 
		FROM homepage_content LIMIT 1
	`).Scan(&content.ID, &content.HeroTitle, &content.HeroSubtitle, &content.CTAPrimaryText, &content.CTASecondaryText)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch homepage content"})
		return
	}

	c.JSON(http.StatusOK, content)
}

func (h *HomepageHandler) UpdateContent(c *gin.Context) {
	var req struct {
		HeroTitle        string `json:"hero_title"`
		HeroSubtitle     string `json:"hero_subtitle"`
		CTAPrimaryText   string `json:"cta_primary_text"`
		CTASecondaryText string `json:"cta_secondary_text"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	_, err := h.pool.Exec(c.Request.Context(), `
		UPDATE homepage_content 
		SET hero_title = $1, hero_subtitle = $2, cta_primary_text = $3, cta_secondary_text = $4, updated_at = NOW()
		WHERE id = 1
	`, req.HeroTitle, req.HeroSubtitle, req.CTAPrimaryText, req.CTASecondaryText)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update homepage content"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *HomepageHandler) UploadImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Image file is required"})
		return
	}

	// Make sure uploads directory exists
	uploadDir := "uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	filename := uuid.New().String() + filepath.Ext(file.Filename)
	filePath := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	id := uuid.New()
	_, err = h.pool.Exec(c.Request.Context(), `
		INSERT INTO homepage_images (id, file_path, alt_text) VALUES ($1, $2, $3)
	`, id, "/"+filePath, file.Filename)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save image record"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":        id,
		"file_path": "/" + filePath,
	})
}

func (h *HomepageHandler) GetImages(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT id, file_path, alt_text, is_active FROM homepage_images ORDER BY uploaded_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch images"})
		return
	}
	defer rows.Close()

	var images []gin.H
	for rows.Next() {
		var id, filePath, altText string
		var isActive bool
		if err := rows.Scan(&id, &filePath, &altText, &isActive); err == nil {
			images = append(images, gin.H{
				"id":        id,
				"file_path": filePath,
				"alt_text":  altText,
				"is_active": isActive,
			})
		}
	}

	c.JSON(http.StatusOK, images)
}
