package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"skillture/backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WorkshopHandler manages the admin-authored events shown on the homepage's
// "Upcoming Workshops" section. Follows the same direct-pool, no-repository
// pattern as HomepageHandler — this is CMS content, not a domain aggregate.
type WorkshopHandler struct {
	pool      *pgxpool.Pool
	uploadCfg config.UploadConfig
}

func NewWorkshopHandler(pool *pgxpool.Pool, uploadCfg config.UploadConfig) *WorkshopHandler {
	return &WorkshopHandler{pool: pool, uploadCfg: uploadCfg}
}

type workshop struct {
	ID          string          `json:"id"`
	Title       json.RawMessage `json:"title"`
	Description json.RawMessage `json:"description"`
	ExtraInfo   json.RawMessage `json:"extra_info,omitempty"`
	ImagePath   *string         `json:"image_path"`
	EventDate   string          `json:"event_date"`
	EventTime   *string         `json:"event_time"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

const workshopSelectCols = `id, title, description, extra_info, image_path, event_date, event_time, created_at, updated_at`

func scanWorkshop(row pgx.Row) (workshop, error) {
	var w workshop
	var eventDate time.Time
	var extraInfo *json.RawMessage
	if err := row.Scan(
		&w.ID, &w.Title, &w.Description, &extraInfo, &w.ImagePath, &eventDate, &w.EventTime, &w.CreatedAt, &w.UpdatedAt,
	); err != nil {
		return w, err
	}
	w.EventDate = eventDate.Format("2006-01-02")
	if extraInfo != nil {
		w.ExtraInfo = *extraInfo
	}
	return w, nil
}

// ListUpcoming is public: only workshops whose date has not passed, soonest
// first. This is what the homepage's Upcoming Workshops section reads.
func (h *WorkshopHandler) ListUpcoming(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT `+workshopSelectCols+`
		FROM workshops
		WHERE event_date >= CURRENT_DATE
		ORDER BY event_date ASC, event_time ASC NULLS LAST
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workshops"})
		return
	}
	defer rows.Close()

	workshops := []workshop{}
	for rows.Next() {
		w, err := scanWorkshop(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read workshop row"})
			return
		}
		workshops = append(workshops, w)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workshops"})
		return
	}

	c.JSON(http.StatusOK, workshops)
}

// ListAll is admin-only: every workshop, past or future, for the management
// table in the dashboard.
func (h *WorkshopHandler) ListAll(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT `+workshopSelectCols+`
		FROM workshops
		ORDER BY event_date DESC, event_time DESC NULLS LAST
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workshops"})
		return
	}
	defer rows.Close()

	workshops := []workshop{}
	for rows.Next() {
		w, err := scanWorkshop(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read workshop row"})
			return
		}
		workshops = append(workshops, w)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workshops"})
		return
	}

	c.JSON(http.StatusOK, workshops)
}

type workshopWriteRequest struct {
	Title       map[string]string `json:"title" binding:"required"`
	Description map[string]string `json:"description" binding:"required"`
	ExtraInfo   map[string]string `json:"extra_info"`
	ImagePath   *string           `json:"image_path"`
	EventDate   string            `json:"event_date" binding:"required"`
	EventTime   *string           `json:"event_time"`
}

func (req workshopWriteRequest) validate() error {
	if strings.TrimSpace(req.Title["en"]) == "" || strings.TrimSpace(req.Title["ar"]) == "" {
		return fmt.Errorf("title requires both an English and an Arabic value")
	}
	if strings.TrimSpace(req.Description["en"]) == "" || strings.TrimSpace(req.Description["ar"]) == "" {
		return fmt.Errorf("description requires both an English and an Arabic value")
	}
	if _, err := time.Parse("2006-01-02", req.EventDate); err != nil {
		return fmt.Errorf("event_date must be YYYY-MM-DD")
	}
	return nil
}

func (h *WorkshopHandler) Create(c *gin.Context) {
	var req workshopWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}
	if err := req.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	_, err := h.pool.Exec(c.Request.Context(), `
		INSERT INTO workshops (id, title, description, extra_info, image_path, event_date, event_time, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
	`, id, req.Title, req.Description, nullableMap(req.ExtraInfo), req.ImagePath, req.EventDate, req.EventTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create workshop"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *WorkshopHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workshop id"})
		return
	}

	var req workshopWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}
	if err := req.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag, err := h.pool.Exec(c.Request.Context(), `
		UPDATE workshops
		SET title = $1, description = $2, extra_info = $3, image_path = $4,
		    event_date = $5, event_time = $6, updated_at = NOW()
		WHERE id = $7
	`, req.Title, req.Description, nullableMap(req.ExtraInfo), req.ImagePath, req.EventDate, req.EventTime, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update workshop"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workshop not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *WorkshopHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workshop id"})
		return
	}

	tag, err := h.pool.Exec(c.Request.Context(), `DELETE FROM workshops WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete workshop"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workshop not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// UploadImage stores a workshop's cover image and returns its path, the same
// two-step flow as HomepageHandler.UploadImage: upload first, then the
// create/update payload above carries the returned image_path.
func (h *WorkshopHandler) UploadImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Image file is required"})
		return
	}

	if maxBytes := h.uploadCfg.MaxSizeBytes(); file.Size > maxBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": fmt.Sprintf("file exceeds the %d MB limit", h.uploadCfg.MaxSizeMB),
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !h.uploadCfg.IsAllowedType(ext) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "unsupported file type; allowed: " + strings.Join(h.uploadCfg.AllowedTypes, ", "),
		})
		return
	}

	if err := verifyImageContent(file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uploadDir := "uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
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

// nullableMap turns an empty/nil map into a real SQL NULL instead of the
// JSONB literal `{}`, so extra_info round-trips as null when the admin left
// it blank rather than coming back as an empty-but-present object.
func nullableMap(m map[string]string) any {
	if len(m) == 0 {
		return nil
	}
	return m
}
