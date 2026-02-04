package interfaces

import (
	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/repository/interfaces"
	"context"

	"github.com/google/uuid"
)

// ResponseUseCase defines operations for form submissions
type ResponseUseCase interface {
	Create(ctx context.Context, tx interfaces.Transaction, response *entities.Response) error

	// Submit creates a new response with its answers
	Submit(ctx context.Context, response *entities.Response) error

	// GetByID fetches a response by its ID
	GetByID(ctx context.Context, id uuid.UUID) (*entities.Response, error)

	// ListByForm lists all responses for a given form
	ListByForm(ctx context.Context, formID uuid.UUID) ([]*entities.Response, error)

	// Delete removes a response and all its answers
	Delete(ctx context.Context, id uuid.UUID) error
}
