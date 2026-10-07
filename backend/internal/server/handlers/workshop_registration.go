package handlers

import (
	"encoding/csv"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Workshop registration: a visitor leaves a name and an email for an upcoming
// workshop so the organisers know who is coming. Methods live on
// WorkshopHandler because they share its pool and its notion of "upcoming".

const (
	maxRegistrantNameLen  = 120
	maxRegistrantEmailLen = 254
)

// Error codes returned in {"code": ...} so the public page can show a message
// in the visitor's own language instead of an English server sentence.
const (
	regCodeNameRequired     = "name_required"
	regCodeNameInvalid      = "name_invalid"
	regCodeNameTooLong      = "name_too_long"
	regCodeEmailInvalid     = "email_invalid"
	regCodeNotFound         = "workshop_not_found"
	regCodeEnded            = "workshop_ended"
	regCodeClosed           = "registration_closed"
	regCodeFull             = "workshop_full"
	regCodeAlreadyRegisterd = "already_registered"
)

// Registrations and the site contact email share the contact form's rule.
var registrantEmailRegex = contactEmailRegex

// registrationState derives what the public page needs from the stored facts.
// spotsLeft is nil when the workshop has no seat limit.
func registrationState(isPast, open bool, capacity *int, registered int) (spotsLeft *int, status string) {
	if capacity != nil {
		left := *capacity - registered
		if left < 0 {
			left = 0
		}
		spotsLeft = &left
	}
	switch {
	case isPast:
		status = "ended"
	case !open:
		status = "closed"
	case capacity != nil && registered >= *capacity:
		status = "full"
	default:
		status = "open"
	}
	return spotsLeft, status
}

type registrationRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	// Website is a honeypot: the form hides it from people, so only a bot fills
	// it in. Such a submission is acknowledged and dropped.
	Website string `json:"website"`
}

// clean trims and validates the input. It returns the normalised name and
// (lower-cased) email, or an error code and message.
func (r registrationRequest) clean() (name, email, code, message string) {
	name = strings.Join(strings.Fields(r.Name), " ")
	email = strings.ToLower(strings.TrimSpace(r.Email))

	switch {
	case name == "":
		return "", "", regCodeNameRequired, "Please enter your name"
	case len([]rune(name)) > maxRegistrantNameLen:
		return "", "", regCodeNameTooLong, fmt.Sprintf("Name must be at most %d characters", maxRegistrantNameLen)
	}
	for _, ch := range name {
		if unicode.IsControl(ch) {
			return "", "", regCodeNameInvalid, "Name contains invalid characters"
		}
	}
	if len(email) > maxRegistrantEmailLen || !registrantEmailRegex.MatchString(email) {
		return "", "", regCodeEmailInvalid, "Please enter a valid email address"
	}
	return name, email, "", ""
}

func registrationError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": message, "code": code})
}

// Register is public: POST /api/v1/workshops/:id/register
//
// The workshop row is locked for the duration of the transaction so two people
// taking the last seat cannot both succeed.
func (h *WorkshopHandler) Register(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		registrationError(c, http.StatusNotFound, regCodeNotFound, "Workshop not found")
		return
	}

	var req registrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		registrationError(c, http.StatusBadRequest, regCodeNameRequired, "Please enter your name and email")
		return
	}
	if strings.TrimSpace(req.Website) != "" {
		// Bot. Say yes and store nothing.
		c.JSON(http.StatusCreated, gin.H{"status": "registered"})
		return
	}
	name, email, code, message := req.clean()
	if code != "" {
		registrationError(c, http.StatusBadRequest, code, message)
		return
	}

	ctx := c.Request.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		registrationError(c, http.StatusInternalServerError, "server_error", "Could not complete your registration, please try again")
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var isPast, open bool
	var capacity *int
	err = tx.QueryRow(ctx, `
		SELECT event_date < CURRENT_DATE, registration_open, capacity
		FROM workshops WHERE id = $1 FOR UPDATE
	`, id).Scan(&isPast, &open, &capacity)
	if errors.Is(err, pgx.ErrNoRows) {
		registrationError(c, http.StatusNotFound, regCodeNotFound, "Workshop not found")
		return
	}
	if err != nil {
		registrationError(c, http.StatusInternalServerError, "server_error", "Could not complete your registration, please try again")
		return
	}
	if isPast {
		registrationError(c, http.StatusUnprocessableEntity, regCodeEnded, "This workshop has already taken place")
		return
	}
	if !open {
		registrationError(c, http.StatusUnprocessableEntity, regCodeClosed, "Registration for this workshop is closed")
		return
	}

	if capacity != nil {
		var registered int
		if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM workshop_registrations WHERE workshop_id = $1`, id).Scan(&registered); err != nil {
			registrationError(c, http.StatusInternalServerError, "server_error", "Could not complete your registration, please try again")
			return
		}
		if registered >= *capacity {
			registrationError(c, http.StatusConflict, regCodeFull, "This workshop is full")
			return
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO workshop_registrations (id, workshop_id, name, email, created_at)
		VALUES ($1, $2, $3, $4, NOW())
	`, uuid.New(), id, name, email)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			registrationError(c, http.StatusConflict, regCodeAlreadyRegisterd, "This email is already registered for this workshop")
			return
		}
		registrationError(c, http.StatusInternalServerError, "server_error", "Could not complete your registration, please try again")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		registrationError(c, http.StatusInternalServerError, "server_error", "Could not complete your registration, please try again")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "registered"})
}

type registrant struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

// workshopTitleEN returns the workshop's English title, and false if the
// workshop does not exist.
func (h *WorkshopHandler) workshopTitleEN(c *gin.Context, id uuid.UUID) (string, bool) {
	var title *string
	err := h.pool.QueryRow(c.Request.Context(), `SELECT title->>'en' FROM workshops WHERE id = $1`, id).Scan(&title)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workshop not found"})
		return "", false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workshop"})
		return "", false
	}
	if title == nil {
		return "", true
	}
	return *title, true
}

func (h *WorkshopHandler) loadRegistrants(c *gin.Context, id uuid.UUID) ([]registrant, bool) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT id, name, email, created_at FROM workshop_registrations
		WHERE workshop_id = $1 ORDER BY created_at ASC, id ASC
	`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch registrations"})
		return nil, false
	}
	defer rows.Close()

	out := []registrant{}
	for rows.Next() {
		var r registrant
		if err := rows.Scan(&r.ID, &r.Name, &r.Email, &r.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read registration row"})
			return nil, false
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch registrations"})
		return nil, false
	}
	return out, true
}

// ListRegistrations is admin-only: GET /api/v1/admin/workshops/:id/registrations
func (h *WorkshopHandler) ListRegistrations(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workshop id"})
		return
	}
	if _, ok := h.workshopTitleEN(c, id); !ok {
		return
	}
	registrants, ok := h.loadRegistrants(c, id)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, registrants)
}

// DeleteRegistration is admin-only:
// DELETE /api/v1/admin/workshops/:id/registrations/:rid
func (h *WorkshopHandler) DeleteRegistration(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workshop id"})
		return
	}
	rid, err := uuid.Parse(c.Param("rid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid registration id"})
		return
	}
	// Scoped by workshop, so the id in the URL means what it says.
	tag, err := h.pool.Exec(c.Request.Context(),
		`DELETE FROM workshop_registrations WHERE id = $1 AND workshop_id = $2`, rid, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete registration"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// csvSafe neutralises spreadsheet formulas. A name such as "=HYPERLINK(...)"
// typed into a public form would otherwise execute when an organiser opens the
// export in Excel or Sheets.
func csvSafe(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func fileSlug(title string) string {
	s := strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(title), "-"), "-")
	if s == "" {
		return "workshop"
	}
	if len(s) > 40 {
		s = strings.Trim(s[:40], "-")
	}
	return s
}

// ExportRegistrations is admin-only:
// GET /api/v1/admin/workshops/:id/registrations.csv
func (h *WorkshopHandler) ExportRegistrations(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workshop id"})
		return
	}
	title, ok := h.workshopTitleEN(c, id)
	if !ok {
		return
	}
	registrants, ok := h.loadRegistrants(c, id)
	if !ok {
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="registrations-%s-%s.csv"`,
		fileSlug(title), time.Now().UTC().Format("2006-01-02")))
	c.Header("Cache-Control", "no-store")
	c.Status(http.StatusOK)

	// A byte-order mark makes Excel read the file as UTF-8, so Arabic names
	// survive the round trip.
	_, _ = c.Writer.WriteString("\xEF\xBB\xBF")
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"Name", "Email", "Registered at (UTC)"})
	for _, r := range registrants {
		_ = w.Write([]string{csvSafe(r.Name), csvSafe(r.Email), r.CreatedAt.UTC().Format(time.RFC3339)})
	}
	w.Flush()
}
