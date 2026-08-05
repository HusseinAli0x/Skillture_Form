package interfaces

import (
	"skillture/backend/internal/domain/entities"
	"context"

	"github.com/google/uuid"
)

// ResponseUseCase defines operations for form submissions
type ResponseUseCase interface {

	// Submit creates a new response with its answers
	Submit(ctx context.Context, response *entities.Response, answers []*entities.ResponseAnswer, vectors []*entities.ResponseAnswerVector) error

	// GetByID fetches a response by its ID
	GetByID(ctx context.Context, id uuid.UUID) (*entities.Response, error)

	// GetAnswers fetches all answers for a specific response
	GetAnswers(ctx context.Context, responseID uuid.UUID) ([]*entities.ResponseAnswer, error)

	// ListByForm lists all responses for a given form
	ListByForm(ctx context.Context, formID uuid.UUID) ([]*entities.Response, error)

	// ListDetailedByForm lists all responses with their answers for a given form
	ListDetailedByForm(ctx context.Context, formID uuid.UUID) ([]*ResponseDetail, error)

	// Delete removes a response and all its answers
	Delete(ctx context.Context, id uuid.UUID) error
}

// ResponseDetail is a composite object of Response and its Answers
type ResponseDetail struct {
	*entities.Response
	Answers []*entities.ResponseAnswer `json:"answers"`
}
