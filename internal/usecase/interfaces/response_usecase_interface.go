package interfaces

import (
	"Skillture_Form/internal/domain/entities"
	"context"

	"github.com/google/uuid"
)

// ResponseUseCase defines operations for form submissions
type ResponseUseCase interface {

	// Submit creates a new response with its answers
	Submit(ctx context.Context, response *entities.Response, answers []*entities.ResponseAnswer, vectors []*entities.ResponseAnswerVector) error

	// GetByID fetches a response by its ID
	GetByID(ctx context.Context, id uuid.UUID) (*entities.Response, error)

	// ListByForm lists all responses for a given form
	ListByForm(ctx context.Context, formID uuid.UUID) ([]*entities.Response, error)

	// Delete removes a response and all its answers
	Delete(ctx context.Context, id uuid.UUID) error
}
