package interfaces

import (
	"context"

	"Skillture_Form/internal/domain/entities"

	"github.com/google/uuid"
)

type ResponseRepository interface {
	Create(ctx context.Context, response *entities.Response) error
	GetByID(ctx context.Context, id uuid.UUID) (*entities.Response, error)
	ListByFormID(ctx context.Context, formID uuid.UUID) ([]*entities.Response, error)
	Delete(ctx context.Context, id uuid.UUID) error
	// WithTx executes a function inside a transaction
	WithTx(
		ctx context.Context,
		fn func(
			responseRepo ResponseRepository,
			answerRepo ResponseAnswerRepository,
			vectorRepo ResponseAnswerVectorRepository,
		) error,
	) error
}
