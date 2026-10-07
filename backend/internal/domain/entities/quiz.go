package entities

import (
	"errors"
	"skillture/backend/internal/domain/enums"
	"time"

	"github.com/google/uuid"
)

// Domain errors for the Quiz entity
var (
	ErrInvalidQuizStatus = errors.New("invalid quiz status")
	ErrMissingQuizTitle  = errors.New("quiz title is missing")
)

// Quiz represents a quiz created by an admin in the dashboard.
// Title and Description use the same multilingual JSONB pattern
// as the Forms module: {"en": "...", "ar": "..."}.
type Quiz struct {
	ID          uuid.UUID         `db:"id"          json:"id"`
	Title       map[string]string `db:"title"       json:"title"`
	Description map[string]string `db:"description" json:"description,omitempty"`
	Status      enums.QuizStatus  `db:"status"      json:"status"`
	CreatedAt   time.Time         `db:"created_at"  json:"created_at"`

	// OwnerKeyHash is the SHA-256 of the host key of the visitor who created
	// the quiz (see auth.HostKeyHeader); nil for quizzes created by an admin.
	// It is an access-control secret's hash and is never serialised.
	OwnerKeyHash *string `db:"owner_key_hash" json:"-"`
	// ByVisitor tells the admin which quizzes came from the public site.
	ByVisitor bool `db:"-" json:"by_visitor"`
}

// TableName returns the PostgreSQL table name
func (Quiz) TableName() string {
	return "quizzes"
}

// IsActive checks if the quiz is in an active (published) state
func (q *Quiz) IsActive() bool {
	return q.Status == enums.QuizStatusActive
}

// GetTitle returns the title in the requested language, falling back to English
func (q *Quiz) GetTitle(lang string) string {
	if val, ok := q.Title[lang]; ok && val != "" {
		return val
	}
	if val, ok := q.Title["en"]; ok {
		return val
	}
	return ""
}

// GetDescription returns the description in the requested language, falling back to English
func (q *Quiz) GetDescription(lang string) string {
	if q.Description == nil {
		return ""
	}
	if val, ok := q.Description[lang]; ok && val != "" {
		return val
	}
	if val, ok := q.Description["en"]; ok {
		return val
	}
	return ""
}

// IsValid validates domain-level rules for a Quiz
func (q *Quiz) IsValid() error {
	if len(q.Title) == 0 {
		return ErrMissingQuizTitle
	}
	if !q.Status.IsValid() {
		return ErrInvalidQuizStatus
	}
	return nil
}
