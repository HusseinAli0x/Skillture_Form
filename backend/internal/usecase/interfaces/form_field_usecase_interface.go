package interfaces

import (
	"context"

	"skillture/backend/internal/domain/entities"

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

	// ReplaceFields makes the form's fields match the given slice exactly, in a
	// single transaction. Field order is taken from the slice order, so the
	// caller does not have to keep field_order consistent itself.
	ReplaceFields(ctx context.Context, formID uuid.UUID, fields []*entities.FormField) error
}
