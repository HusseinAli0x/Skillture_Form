package interfaces

import (
	"Skillture_Form/internal/domain/entities"
	"context"

	"github.com/google/uuid"
)

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

	// GetByID returns a form with its fields
	GetByID(ctx context.Context, formID uuid.UUID) (*entities.Form, error)
}
