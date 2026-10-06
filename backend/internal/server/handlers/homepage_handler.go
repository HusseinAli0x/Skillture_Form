package handlers

import (
	"context"
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

// homepageFact is one of the three stat tiles beside the About Us copy.
type homepageFact struct {
	ID           string `json:"id"`
	Value        string `json:"value"`
	Label        string `json:"label"`
	DisplayOrder int    `json:"display_order"`
}

// homepagePillar is one of the four "What We Offer" cards.
type homepagePillar struct {
	ID           string   `json:"id"`
	Num          string   `json:"num"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Points       []string `json:"points"`
	DisplayOrder int      `json:"display_order"`
}

func (h *HomepageHandler) GetContent(c *gin.Context) {
	var content struct {
		ID               int    `json:"id"`
		HeroKicker       string `json:"hero_kicker"`
		HeroTitle        string `json:"hero_title"`
		HeroSubtitle     string `json:"hero_subtitle"`
		CTAPrimaryText   string `json:"cta_primary_text"`
		CTASecondaryText string `json:"cta_secondary_text"`
		AboutKicker      string `json:"about_kicker"`
		AboutTitle       string `json:"about_title"`
		AboutBody1       string `json:"about_body1"`
		AboutBody2       string `json:"about_body2"`
		OfferKicker      string `json:"offer_kicker"`
		OfferTitle       string `json:"offer_title"`
		OfferSubtitle    string `json:"offer_subtitle"`
	}

	err := h.pool.QueryRow(c.Request.Context(), `
		SELECT id, hero_kicker, hero_title, hero_subtitle, cta_primary_text, cta_secondary_text,
		       about_kicker, about_title, about_body1, about_body2,
		       offer_kicker, offer_title, offer_subtitle
		FROM homepage_content LIMIT 1
	`).Scan(
		&content.ID, &content.HeroKicker, &content.HeroTitle, &content.HeroSubtitle,
		&content.CTAPrimaryText, &content.CTASecondaryText,
		&content.AboutKicker, &content.AboutTitle, &content.AboutBody1, &content.AboutBody2,
		&content.OfferKicker, &content.OfferTitle, &content.OfferSubtitle,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch homepage content"})
		return
	}

	facts, err := h.fetchFacts(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch about facts"})
		return
	}

	pillars, err := h.fetchPillars(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch offer pillars"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                 content.ID,
		"hero_kicker":        content.HeroKicker,
		"hero_title":         content.HeroTitle,
		"hero_subtitle":      content.HeroSubtitle,
		"cta_primary_text":   content.CTAPrimaryText,
		"cta_secondary_text": content.CTASecondaryText,
		"about_kicker":       content.AboutKicker,
		"about_title":        content.AboutTitle,
		"about_body1":        content.AboutBody1,
		"about_body2":        content.AboutBody2,
		"about_facts":        facts,
		"offer_kicker":       content.OfferKicker,
		"offer_title":        content.OfferTitle,
		"offer_subtitle":     content.OfferSubtitle,
		"offer_pillars":      pillars,
	})
}

func (h *HomepageHandler) fetchFacts(ctx context.Context) ([]homepageFact, error) {
	rows, err := h.pool.Query(ctx, `
		SELECT id, value, label, display_order FROM homepage_about_facts ORDER BY display_order, id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	facts := []homepageFact{}
	for rows.Next() {
		var f homepageFact
		if err := rows.Scan(&f.ID, &f.Value, &f.Label, &f.DisplayOrder); err != nil {
			return nil, err
		}
		facts = append(facts, f)
	}
	return facts, rows.Err()
}

func (h *HomepageHandler) fetchPillars(ctx context.Context) ([]homepagePillar, error) {
	rows, err := h.pool.Query(ctx, `
		SELECT id, num, title, description, points, display_order
		FROM homepage_offer_pillars ORDER BY display_order, id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pillars := []homepagePillar{}
	for rows.Next() {
		var p homepagePillar
		if err := rows.Scan(&p.ID, &p.Num, &p.Title, &p.Description, &p.Points, &p.DisplayOrder); err != nil {
			return nil, err
		}
		pillars = append(pillars, p)
	}
	return pillars, rows.Err()
}

func (h *HomepageHandler) UpdateContent(c *gin.Context) {
	var req struct {
		HeroKicker       string `json:"hero_kicker"`
		HeroTitle        string `json:"hero_title"`
		HeroSubtitle     string `json:"hero_subtitle"`
		CTAPrimaryText   string `json:"cta_primary_text"`
		CTASecondaryText string `json:"cta_secondary_text"`
		AboutKicker      string `json:"about_kicker"`
		AboutTitle       string `json:"about_title"`
		AboutBody1       string `json:"about_body1"`
		AboutBody2       string `json:"about_body2"`
		OfferKicker      string `json:"offer_kicker"`
		OfferTitle       string `json:"offer_title"`
		OfferSubtitle    string `json:"offer_subtitle"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	_, err := h.pool.Exec(c.Request.Context(), `
		UPDATE homepage_content
		SET hero_kicker = $1, hero_title = $2, hero_subtitle = $3,
		    cta_primary_text = $4, cta_secondary_text = $5,
		    about_kicker = $6, about_title = $7, about_body1 = $8, about_body2 = $9,
		    offer_kicker = $10, offer_title = $11, offer_subtitle = $12,
		    updated_at = NOW()
		WHERE id = 1
	`,
		req.HeroKicker, req.HeroTitle, req.HeroSubtitle,
		req.CTAPrimaryText, req.CTASecondaryText,
		req.AboutKicker, req.AboutTitle, req.AboutBody1, req.AboutBody2,
		req.OfferKicker, req.OfferTitle, req.OfferSubtitle,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update homepage content"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// UpdateFacts replaces the full set of About Us stat tiles. The design has a
// fixed three-tile layout, so this is a full-replace rather than per-row
// CRUD — the admin edits all three at once and this swaps them atomically.
func (h *HomepageHandler) UpdateFacts(c *gin.Context) {
	var req []struct {
		Value string `json:"value" binding:"required"`
		Label string `json:"label" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}
	if len(req) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one fact is required"})
		return
	}

	tx, err := h.pool.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update facts"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	if _, err := tx.Exec(c.Request.Context(), `DELETE FROM homepage_about_facts`); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update facts"})
		return
	}
	for i, f := range req {
		if _, err := tx.Exec(c.Request.Context(), `
			INSERT INTO homepage_about_facts (id, value, label, display_order) VALUES (gen_random_uuid(), $1, $2, $3)
		`, f.Value, f.Label, i); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update facts"})
			return
		}
	}
	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update facts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// UpdatePillars replaces the full set of "What We Offer" pillars. Same
// full-replace rationale as UpdateFacts — the design's four pillars are a
// fixed layout, not an open-ended list.
func (h *HomepageHandler) UpdatePillars(c *gin.Context) {
	var req []struct {
		Num         string   `json:"num" binding:"required"`
		Title       string   `json:"title" binding:"required"`
		Description string   `json:"description" binding:"required"`
		Points      []string `json:"points"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}
	if len(req) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one pillar is required"})
		return
	}

	tx, err := h.pool.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update pillars"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	if _, err := tx.Exec(c.Request.Context(), `DELETE FROM homepage_offer_pillars`); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update pillars"})
		return
	}
	for i, p := range req {
		points := p.Points
		if points == nil {
			points = []string{}
		}
		if _, err := tx.Exec(c.Request.Context(), `
			INSERT INTO homepage_offer_pillars (id, num, title, description, points, display_order)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
		`, p.Num, p.Title, p.Description, points, i); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update pillars"})
			return
		}
	}
	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update pillars"})
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
