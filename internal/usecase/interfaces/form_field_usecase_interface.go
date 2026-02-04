package interfaces

import (
	"context"

	"Skillture_Form/internal/domain/entities"

	"github.com/google/uuid"
)

// FormFieldUseCase defines business operations for form fields.
type FormFieldUseCase interface {

	// Create adds a new field to a form.
	Create(ctx context.Context, field *entities.FormField) error

	// Update updates an existing form field.
	Update(ctx context.Context, field *entities.FormField) error

	// Delete removes a field from a form.
	Delete(ctx context.Context, fieldID uuid.UUID) error

	// ListByFormID returns all fields for a specific form.
	ListByFormID(ctx context.Context, formID uuid.UUID) ([]*entities.FormField, error)
}
