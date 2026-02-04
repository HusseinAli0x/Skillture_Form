package interfaces

import (
	"Skillture_Form/internal/domain/entities"
	"context"

	"github.com/google/uuid"
)

// FormRepository
// Filter object
type FormFilter struct {
	Status *int16
	Title  *string
}

type FormRepository interface {
	// Create saves
	Create(ctx context.Context, tx Transaction, form *entities.Form) error
	// GetByID retrieves an admin by their ID
	GetByID(ctx context.Context, tx Transaction, id uuid.UUID) (*entities.Form, error)
	// Update modifies admin details
	Update(ctx context.Context, tx Transaction, form *entities.Form) error
	// Delete removes an admin
	Delete(ctx context.Context, tx Transaction, id uuid.UUID) error
	// List retrieves forms based on optional filter
	List(ctx context.Context, tx Transaction, filter FormFilter) ([]*entities.Form, error)
}
