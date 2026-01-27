package entities

import (
	"time"

	"github.com/google/uuid"
)

type FormField struct {
	ID         uuid.UUID      `db:"id" json:"id"`
	FormID     uuid.UUID      `db:"form_id" json:"form_id"`
	Label      string         `db:"label" json:"label"`
	Required   bool           `db:"required" json:"required"`
	Options    map[string]any `db:"options" json:"option"` // JSONB
	FieldOrder int            `db:"field_order" json:"field_order"`
	Type       int16          `db:"type" json:"type"`
	CreatedAt  time.Time      `db:"created_at" json:"created_at"`
}
