package entities

import (
	"Skillture_Form/internal/domain/enums"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Domain errors
var (
	ErrMissingFormID     = errors.New("form ID is missing")
	ErrMissingRespondent = errors.New("respondent info is missing")
	ErrInvalidStatus     = errors.New("invalid response status")
)

// Response represents a single form submission by a user
type Response struct {
	ID          uuid.UUID            `db:"id" json:"id"`
	FormID      uuid.UUID            `db:"form_id" json:"form_id"`
	Respondent  map[string]any       `db:"respondent" json:"respondent"` // JSONB: {"email": "...", "name": "...", "phone": "..."}
	Status      enums.ResponseStatus `db:"status" json:"status"`         // Enum: Pending, Submitted, Reviewed
	SubmittedAt time.Time            `db:"submitted_at" json:"submitted_at"`
	Answers     []*ResponseAnswer    `json:"answers,omitempty"` // Populated by usecase, not stored in DB
}

// TableName returns the DB table name
func (Response) TableName() string {
	return "responses"
}

// GetEmail returns the email of the respondent if exists
func (r *Response) GetEmail() string {
	if email, ok := r.Respondent["email"].(string); ok {
		return email
	}
	return ""
}

// GetName returns the name of the respondent if exists
func (r *Response) GetName() string {
	if name, ok := r.Respondent["name"].(string); ok {
		return name
	}
	return ""
}

// SetEmail sets or updates the email in the respondent JSON
func (r *Response) SetEmail(email string) {
	if r.Respondent == nil {
		r.Respondent = make(map[string]any)
	}
	r.Respondent["email"] = email
}

// SetName sets or updates the name in the respondent JSON
func (r *Response) SetName(name string) {
	if r.Respondent == nil {
		r.Respondent = make(map[string]any)
	}
	r.Respondent["name"] = name
}

// IsValid validates domain rules
func (r *Response) IsValid() error {
	if r.FormID == uuid.Nil {
		return ErrMissingFormID
	}
	if len(r.Respondent) == 0 {
		return ErrMissingRespondent
	}
	if !r.Status.IsValid() {
		return ErrInvalidStatus
	}
	return nil
}
