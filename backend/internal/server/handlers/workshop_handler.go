package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
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
	ID           string          `json:"id"`
	Title        json.RawMessage `json:"title"`
	Description  json.RawMessage `json:"description"`
	ExtraInfo    json.RawMessage `json:"extra_info,omitempty"`
	ImagePath    *string         `json:"image_path"`
	EventDate    string          `json:"event_date"`
	EventTime    *string         `json:"event_time"`
	Track        *string         `json:"track"`
	Location     *string         `json:"location"`
	Speaker      *string         `json:"speaker"`
	Attendees    *int            `json:"attendees"`
	Outcome      json.RawMessage `json:"outcome,omitempty"`
	Recap        json.RawMessage `json:"recap,omitempty"`
	Gallery      []string        `json:"gallery"`
	Registration *string         `json:"registration_url"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`

	// Built-in registration (see workshop_registration.go).
	RegistrationOpen bool `json:"registration_open"`
	Capacity         *int `json:"capacity"`
	// Registered is how many people have signed up so far.
	Registered int `json:"registered"`
	// SpotsLeft is nil when the workshop has no seat limit.
	SpotsLeft *int `json:"spots_left"`
	// RegistrationStatus is what the public page needs to decide whether to
	// show the form: "open", "full", "closed" (switched off) or "ended".
	RegistrationStatus string `json:"registration_status"`
}

const workshopSelectCols = `id, title, description, extra_info, image_path, event_date, event_time,
	track, location, speaker, attendees, outcome, recap, gallery, registration_url, created_at, updated_at,
	registration_open, capacity,
	(SELECT COUNT(*) FROM workshop_registrations r WHERE r.workshop_id = workshops.id),
	(event_date < CURRENT_DATE)`

func scanWorkshop(row pgx.Row) (workshop, error) {
	var w workshop
	var eventDate time.Time
	var extraInfo, outcome, recap *json.RawMessage
	var gallery []byte
	var isPast bool
	if err := row.Scan(
		&w.ID, &w.Title, &w.Description, &extraInfo, &w.ImagePath, &eventDate, &w.EventTime,
		&w.Track, &w.Location, &w.Speaker, &w.Attendees, &outcome, &recap, &gallery, &w.Registration,
		&w.CreatedAt, &w.UpdatedAt,
		&w.RegistrationOpen, &w.Capacity, &w.Registered, &isPast,
	); err != nil {
		return w, err
	}
	w.SpotsLeft, w.RegistrationStatus = registrationState(isPast, w.RegistrationOpen, w.Capacity, w.Registered)
	if outcome != nil {
		w.Outcome = *outcome
	}
	if recap != nil {
		w.Recap = *recap
	}
	w.Gallery = []string{}
	if len(gallery) > 0 {
		if err := json.Unmarshal(gallery, &w.Gallery); err != nil {
			return w, err
		}
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

// ListPast is public: workshops that already happened, newest first. This is
// what the "Our Work" page reads. The optional ?track= filter narrows it to
// one of the four tracks.
func (h *WorkshopHandler) ListPast(c *gin.Context) {
	track := c.Query("track")
	if track != "" && !workshopTracks[track] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown track"})
		return
	}

	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT `+workshopSelectCols+`
		FROM workshops
		WHERE event_date < CURRENT_DATE AND ($1 = '' OR track = $1)
		ORDER BY event_date DESC, event_time DESC NULLS LAST
	`, track)
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

// GetByID is public: one workshop, past or upcoming, for the shareable
// /workshops/:id detail page.
func (h *WorkshopHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workshop id"})
		return
	}

	w, err := scanWorkshop(h.pool.QueryRow(c.Request.Context(),
		`SELECT `+workshopSelectCols+` FROM workshops WHERE id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workshop not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workshop"})
		return
	}

	c.JSON(http.StatusOK, w)
}

// Impact is public: headline numbers for the "Our Work" page and the homepage
// strip, computed from the workshops table so they cannot drift from the
// workshops actually listed.
func (h *WorkshopHandler) Impact(c *gin.Context) {
	var past, upcoming, attendees int
	err := h.pool.QueryRow(c.Request.Context(), `
		SELECT
		  COUNT(*) FILTER (WHERE event_date < CURRENT_DATE),
		  COUNT(*) FILTER (WHERE event_date >= CURRENT_DATE),
		  COALESCE(SUM(attendees) FILTER (WHERE event_date < CURRENT_DATE), 0)
		FROM workshops
	`).Scan(&past, &upcoming, &attendees)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute impact"})
		return
	}

	tracks := gin.H{"technical": 0, "career": 0, "industry": 0, "business": 0}
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT track, COUNT(*) FROM workshops
		WHERE event_date < CURRENT_DATE AND track IS NOT NULL
		GROUP BY track
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute impact"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var track string
		var n int
		if err := rows.Scan(&track, &n); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute impact"})
			return
		}
		tracks[track] = n
	}

	c.JSON(http.StatusOK, gin.H{
		"workshops_held":     past,
		"workshops_upcoming": upcoming,
		"attendees_total":    attendees,
		"tracks":             tracks,
	})
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

	// "Our Work" portfolio fields — all optional.
	Track        *string           `json:"track"`
	Location     *string           `json:"location"`
	Speaker      *string           `json:"speaker"`
	Attendees    *int              `json:"attendees"`
	Outcome      map[string]string `json:"outcome"`
	Recap        map[string]string `json:"recap"`
	Gallery      []string          `json:"gallery"`
	Registration *string           `json:"registration_url"`

	// Built-in registration. RegistrationOpen defaults to true when omitted so
	// existing clients keep working; Capacity nil means no seat limit.
	RegistrationOpen *bool `json:"registration_open"`
	Capacity         *int  `json:"capacity"`
}

// maxWorkshopCapacity is a sanity bound, not a business rule.
const maxWorkshopCapacity = 100000

const maxGalleryImages = 12

var workshopTracks = map[string]bool{"technical": true, "career": true, "industry": true, "business": true}

// blankToNil turns an empty/whitespace-only optional string into SQL NULL.
func blankToNil(p *string) *string {
	if p == nil || strings.TrimSpace(*p) == "" {
		return nil
	}
	v := strings.TrimSpace(*p)
	return &v
}

func (req *workshopWriteRequest) normalize() {
	req.Track = blankToNil(req.Track)
	req.Location = blankToNil(req.Location)
	req.Speaker = blankToNil(req.Speaker)
	req.Registration = blankToNil(req.Registration)
	if req.Gallery == nil {
		req.Gallery = []string{}
	}
	if req.RegistrationOpen == nil {
		open := true
		req.RegistrationOpen = &open
	}
}

func (req workshopWriteRequest) validate() error {
	if req.Track != nil && !workshopTracks[*req.Track] {
		return fmt.Errorf("track must be one of: technical, career, industry, business")
	}
	if req.Attendees != nil && *req.Attendees < 0 {
		return fmt.Errorf("attendees cannot be negative")
	}
	if req.Capacity != nil && (*req.Capacity < 1 || *req.Capacity > maxWorkshopCapacity) {
		return fmt.Errorf("capacity must be between 1 and %d, or left empty for no limit", maxWorkshopCapacity)
	}
	if req.Registration != nil && !isHTTPURL(*req.Registration) {
		return fmt.Errorf("registration_url must be an http(s) URL")
	}
	if len(req.Gallery) > maxGalleryImages {
		return fmt.Errorf("a workshop gallery holds at most %d images", maxGalleryImages)
	}
	for _, g := range req.Gallery {
		if !strings.HasPrefix(g, "/uploads/") || strings.Contains(g, "..") {
			return fmt.Errorf("gallery entries must be uploaded image paths")
		}
	}
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
	req.normalize()
	if err := req.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	_, err := h.pool.Exec(c.Request.Context(), `
		INSERT INTO workshops (id, title, description, extra_info, image_path, event_date, event_time,
		                       track, location, speaker, attendees, outcome, recap, gallery, registration_url,
		                       registration_open, capacity, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
	`, id, req.Title, req.Description, nullableMap(req.ExtraInfo), req.ImagePath, req.EventDate, req.EventTime,
		req.Track, req.Location, req.Speaker, req.Attendees, nullableMap(req.Outcome), nullableMap(req.Recap),
		req.Gallery, req.Registration, *req.RegistrationOpen, req.Capacity)
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
	// Omitted means "leave as it is" on an update (normalize would default it
	// to open, which is right only for a new workshop).
	registrationOpen := req.RegistrationOpen
	req.normalize()
	if err := req.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag, err := h.pool.Exec(c.Request.Context(), `
		UPDATE workshops
		SET title = $1, description = $2, extra_info = $3, image_path = $4,
		    event_date = $5, event_time = $6, track = $7, location = $8, speaker = $9,
		    attendees = $10, outcome = $11, recap = $12, gallery = $13, registration_url = $14,
		    registration_open = COALESCE($15, registration_open), capacity = $16,
		    updated_at = NOW()
		WHERE id = $17
	`, req.Title, req.Description, nullableMap(req.ExtraInfo), req.ImagePath, req.EventDate, req.EventTime,
		req.Track, req.Location, req.Speaker, req.Attendees, nullableMap(req.Outcome), nullableMap(req.Recap),
		req.Gallery, req.Registration, registrationOpen, req.Capacity, id)
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
	saveImageUpload(c, h.uploadCfg)
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

// isHTTPURL reports whether s parses as an absolute http(s) URL. Used for
// admin-supplied links that are rendered as href on the public site, so a
// javascript: or data: URL cannot be stored.
func isHTTPURL(s string) bool {
	u, err := url.Parse(s)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}
