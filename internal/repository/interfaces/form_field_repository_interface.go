package interfaces

import (
	"Skillture_Form/internal/domain/entities"
	"context"

	"github.com/google/uuid"
)

// Filter object for listing form fields
type FormFieldFilter struct {
	FormID *uuid.UUID // optional: if set, list only fields of this form
}

// FormFieldRepository defines CRUD for form fields
type FormFieldRepository interface {
	// Create saves a new form field
	Create(ctx context.Context, field *entities.FormField) error
	// GetByID retrieves a form field by ID
	GetByID(ctx context.Context, id uuid.UUID) (*entities.FormField, error)
	// Update modifies form field details
	Update(ctx context.Context, field *entities.FormField) error
	// Delete removes a form field
	Delete(ctx context.Context, id uuid.UUID) error
	// List retrieves form fields based on optional filter
	List(ctx context.Context, filter FormFieldFilter) ([]*entities.FormField, error)
}
