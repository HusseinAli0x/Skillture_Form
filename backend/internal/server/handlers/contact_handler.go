package handlers

import (
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ContactHandler stores messages sent through the homepage's Contact Us
// form. No email is sent — submissions land in the database and the admin
// dashboard reads them from there (see item 7/8 of the redesign brief).
type ContactHandler struct {
	pool *pgxpool.Pool
}

func NewContactHandler(pool *pgxpool.Pool) *ContactHandler {
	return &ContactHandler{pool: pool}
}

// contactEmailRegex mirrors response_usecase.go's permissive sanity check —
// not a full RFC 5322 validator, just enough to catch an obviously-wrong
// address before it lands in the database.
var contactEmailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type contactSubmission struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// Submit is public: anyone can send a message, no account required.
func (h *ContactHandler) Submit(c *gin.Context) {
	var req struct {
		Name    string `json:"name" binding:"required"`
		Email   string `json:"email" binding:"required"`
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name, email and message are all required"})
		return
	}

	name := strings.TrimSpace(req.Name)
	email := strings.TrimSpace(req.Email)
	message := strings.TrimSpace(req.Message)
	if name == "" || email == "" || message == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name, email and message are all required"})
		return
	}
	if !contactEmailRegex.MatchString(email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address"})
		return
	}
	// Generous but bounded — this is a contact message, not a document upload.
	if len(message) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message is too long"})
		return
	}

	id := uuid.New()
	_, err := h.pool.Exec(c.Request.Context(), `
		INSERT INTO contact_submissions (id, name, email, message, created_at)
		VALUES ($1, $2, $3, $4, NOW())
	`, id, name, email, message)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send your message"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "success"})
}

// List is admin-only: every message received, newest first.
func (h *ContactHandler) List(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT id, name, email, message, created_at FROM contact_submissions ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}
	defer rows.Close()

	submissions := []contactSubmission{}
	for rows.Next() {
		var s contactSubmission
		if err := rows.Scan(&s.ID, &s.Name, &s.Email, &s.Message, &s.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read message row"})
			return
		}
		submissions = append(submissions, s)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}

	c.JSON(http.StatusOK, submissions)
}

func (h *ContactHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message id"})
		return
	}

	tag, err := h.pool.Exec(c.Request.Context(), `DELETE FROM contact_submissions WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}
