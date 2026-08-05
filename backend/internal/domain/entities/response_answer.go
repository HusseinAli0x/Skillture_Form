package entities

import (
	"skillture/backend/internal/domain/enums"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Domain errors
var (
	ErrMissingResponseID = errors.New("response ID is missing")
	ErrMissingFieldID    = errors.New("field ID is missing")
)

// ResponseAnswer represents an answer to a single form field
type ResponseAnswer struct {
	ID         uuid.UUID       `db:"id" json:"id"`
	ResponseID uuid.UUID       `db:"response_id" json:"response_id"`
	FieldID    uuid.UUID       `db:"field_id" json:"field_id"`
	FieldType  enums.FieldType `db:"field_type" json:"field_type"` // Enum type
	Value      map[string]any  `db:"value" json:"value"`           // JSONB: {"en": "...", "ar": "..."}
	CreatedAt  time.Time       `db:"created_at" json:"created_at"`
}

// TableName returns the DB table name
func (ResponseAnswer) TableName() string {
	return "response_answers"
}

// GetValue returns the answer for a specific language
func (ra *ResponseAnswer) GetValue(lang string) string {
	if ra.Value == nil {
		return ""
	}
	if val, ok := ra.Value[lang].(string); ok {
		return val
	}
	return ""
}

// SetValue sets the answer for a specific language
func (ra *ResponseAnswer) SetValue(lang string, val string) {
	if ra.Value == nil {
		ra.Value = make(map[string]any)
	}
	ra.Value[lang] = val
}

// IsValid validates domain rules
func (ra *ResponseAnswer) IsValid() error {
	if ra.ResponseID == uuid.Nil {
		return ErrMissingResponseID
	}
	if ra.FieldID == uuid.Nil {
		return ErrMissingFieldID
	}
	if !ra.FieldType.IsValid() {
		return ErrInvalidFieldType
	}
	return nil
}
