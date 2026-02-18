package interfaces

import (
	"context"

	"Skillture_Form/internal/domain/entities"

	"github.com/google/uuid"
)

// Filter object
type ResponseAnswerFilter struct {
	ResponseID *uuid.UUID
	FieldID    *uuid.UUID
}

type ResponseAnswerRepository interface {
	Create(ctx context.Context, answer *entities.ResponseAnswer) error
	CreateBulk(ctx context.Context, answers []*entities.ResponseAnswer) error
	GetByID(ctx context.Context, id uuid.UUID) (*entities.ResponseAnswer, error)
	List(ctx context.Context, filter ResponseAnswerFilter) ([]*entities.ResponseAnswer, error)
	// WithTx executes operations in a transaction
	WithTx(ctx context.Context, fn func(txRepo ResponseAnswerRepository) error) error
}
