package interfaces

import (
	"context"

	"Skillture_Form/internal/domain/entities"

	"github.com/google/uuid"
)

// FormFilter used for listing forms
type FormFilter struct {
	Status *int16
	Title  *string
}

// FormUseCase defines all business operations related to forms
// This represents the Application Layer (Use Cases)
type FormUseCase interface {

	// Create creates a new form with Draft status
	Create(ctx context.Context, form *entities.Form) error

	// Update updates a form (allowed even after publishing)
	Update(ctx context.Context, form *entities.Form) error

	// Publish changes form status from Draft to Published
	Publish(ctx context.Context, formID uuid.UUID) error

	// Close closes a form and prevents new responses
	Close(ctx context.Context, formID uuid.UUID) error

	// Delete deletes a form even if it has responses
	Delete(ctx context.Context, formID uuid.UUID) error

	// GetByID returns a form by ID
	GetByID(ctx context.Context, formID uuid.UUID) (*entities.Form, error)

	// List returns forms based on filter
	List(ctx context.Context, filter FormFilter) ([]*entities.Form, error)
}
