package entities

import (
	"errors"
	"skillture/backend/internal/domain/enums"
	"time"

	"github.com/google/uuid"
)

// FormField represents a question/field in a form
type FormField struct {
	ID          uuid.UUID         `db:"id" json:"id"`
	FormID      uuid.UUID         `db:"form_id" json:"form_id"`
	Label       map[string]string `db:"label" json:"label"`                       // Multilingual labels {"en":"Name","ar":"الاسم"}
	Placeholder map[string]string `db:"placeholder" json:"placeholder,omitempty"` // Optional multilingual placeholders
	HelpText    map[string]string `db:"help_text" json:"help_text,omitempty"`     // Optional multilingual help text
	Required    bool              `db:"required" json:"required"`                 // Indicates if field is mandatory
	Options     map[string]any    `db:"options" json:"options,omitempty"`         // Only used for select, radio, checkbox
	FieldOrder  int               `db:"field_order" json:"field_order"`           // Order in the form
	Type        enums.FieldType   `db:"type" json:"type"`                         // Enum: restricts to allowed field types (text, select, radio, etc.)
	CreatedAt   time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time         `db:"updated_at" json:"updated_at"`
}

// Erorrs
var ErrInvalidFieldType = errors.New("invalid form status")
var ErrMissingOptions = errors.New("field requires options but none provided")

// TableName returns the DB table name
func (FormField) TableName() string {
	return "form_fields"
}

// HasOptions checks if the field should have selectable options
// Only applies to select, radio, or checkbox types
func (ff *FormField) HasOptions() bool {
	return len(ff.Options) > 0
}

// RequiresOptions returns true if this field type must have options
func (ff *FormField) RequiresOptions() bool {
	// Domain-level rule: these field types must have options
	switch ff.Type {
	case enums.FieldTypeSelect, enums.FieldTypeRadio, enums.FieldTypeCheckbox:
		return true
	default:
		return false
	}
}

// IsValid validates the field at the domain level
// Ensures that the Type is a valid enum and that required options are present
// This validation is independent of any usecase or delivery layer
func (ff *FormField) IsValid() error {
	if !ff.Type.IsValid() {
		// Enum ensures the field type is one of the allowed types
		return ErrInvalidFieldType
	}

	if ff.RequiresOptions() && len(ff.Options) == 0 {
		// Enforce domain rule: select/radio/checkbox must have options
		return ErrMissingOptions
	}

	return nil
}

// IsRequired returns true if the field is mandatory
func (ff *FormField) IsRequired() bool {
	return ff.Required
}

// GetLabel returns the label in the requested language, defaults to English
func (ff *FormField) GetLabel(lang string) string {
	if val, ok := ff.Label[lang]; ok && val != "" {
		return val
	}
	if val, ok := ff.Label["en"]; ok {
		return val
	}
	return ""
}

// GetPlaceholder returns the placeholder in the requested language, defaults to English
func (ff *FormField) GetPlaceholder(lang string) string {
	if ff.Placeholder == nil {
		return ""
	}
	if val, ok := ff.Placeholder[lang]; ok && val != "" {
		return val
	}
	if val, ok := ff.Placeholder["en"]; ok {
		return val
	}
	return ""
}

// GetHelpText returns the help text in the requested language, defaults to English
func (ff *FormField) GetHelpText(lang string) string {
	if ff.HelpText == nil {
		return ""
	}
	if val, ok := ff.HelpText[lang]; ok && val != "" {
		return val
	}
	if val, ok := ff.HelpText["en"]; ok {
		return val
	}
	return ""
}
