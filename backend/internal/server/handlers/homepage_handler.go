package handlers

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"skillture/backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HomepageHandler struct {
	pool      *pgxpool.Pool
	uploadCfg config.UploadConfig
}

func NewHomepageHandler(pool *pgxpool.Pool, uploadCfg config.UploadConfig) *HomepageHandler {
	return &HomepageHandler{pool: pool, uploadCfg: uploadCfg}
}

func (h *HomepageHandler) GetContent(c *gin.Context) {
	var content struct {
		ID               int    `json:"id"`
		HeroTitle        string `json:"hero_title"`
		HeroSubtitle     string `json:"hero_subtitle"`
		CTAPrimaryText   string `json:"cta_primary_text"`
		CTASecondaryText string `json:"cta_secondary_text"`
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

	// Size limit. Uploads are served straight back from /uploads, so an
	// unbounded write is both a disk-fill and a stored-content risk.
	if maxBytes := h.uploadCfg.MaxSizeBytes(); file.Size > maxBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": fmt.Sprintf("file exceeds the %d MB limit", h.uploadCfg.MaxSizeMB),
		})
		return
	}

	// Extension allow-list. filepath.Ext reads the client-supplied filename, so
	// without this an .svg or .html lands in a directory served as static
	// content and executes in the origin — stored XSS.
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !h.uploadCfg.IsAllowedType(ext) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "unsupported file type; allowed: " + strings.Join(h.uploadCfg.AllowedTypes, ", "),
		})
		return
	}

	// The extension is only a claim. Sniff the real content type so a renamed
	// .html cannot ride in as .png.
	if err := verifyImageContent(file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Make sure uploads directory exists
	uploadDir := "uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// The stored name is a fresh UUID, so the client filename never reaches the
	// filesystem — no path traversal, no collisions.
	filename := uuid.New().String() + ext
	filePath := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	id := uuid.New()
	_, err = h.pool.Exec(c.Request.Context(), `
		INSERT INTO homepage_images (id, file_path, alt_text) VALUES ($1, $2, $3)
	`, id, "/"+filePath, sanitizeAltText(file.Filename))

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

	images := []gin.H{}
	for rows.Next() {
		var id, filePath, altText string
		var isActive bool
		if err := rows.Scan(&id, &filePath, &altText, &isActive); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read image row"})
			return
		}
		images = append(images, gin.H{
			"id":        id,
			"file_path": filePath,
			"alt_text":  altText,
			"is_active": isActive,
		})
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch images"})
		return
	}

	c.JSON(http.StatusOK, images)
}

// verifyImageContent sniffs the uploaded bytes and rejects anything that is not
// a real image, regardless of the extension the client claimed.
func verifyImageContent(file *multipart.FileHeader) error {
	f, err := file.Open()
	if err != nil {
		return fmt.Errorf("could not read uploaded file")
	}
	defer f.Close()

	// http.DetectContentType only ever looks at the first 512 bytes.
	head := make([]byte, 512)
	n, err := io.ReadFull(f, head)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return fmt.Errorf("could not read uploaded file")
	}

	contentType := http.DetectContentType(head[:n])
	switch contentType {
	case "image/png", "image/jpeg", "image/gif", "image/webp":
		return nil
	default:
		return fmt.Errorf("file content is not a supported image (detected %s)", contentType)
	}
}

// sanitizeAltText strips control characters and angle brackets from the
// client-supplied filename before it is stored and echoed back by GetImages.
func sanitizeAltText(name string) string {
	name = filepath.Base(name)
	cleaned := strings.Map(func(r rune) rune {
		if r < 0x20 || r == '<' || r == '>' || r == '"' || r == '\'' {
			return -1
		}
		return r
	}, name)
	if len(cleaned) > 255 {
		cleaned = cleaned[:255]
	}
	return cleaned
}
