package interfaces

import (
	"context"

	"skillture/backend/internal/domain/entities"

	"github.com/google/uuid"
)

// Filter object
type ResponseAnswerFilter struct {
	ResponseID  *uuid.UUID
	ResponseIDs []uuid.UUID
	FieldID     *uuid.UUID
}

type ResponseAnswerRepository interface {
	Create(ctx context.Context, answer *entities.ResponseAnswer) error
	CreateBulk(ctx context.Context, answers []*entities.ResponseAnswer) error
	GetByID(ctx context.Context, id uuid.UUID) (*entities.ResponseAnswer, error)
	List(ctx context.Context, filter ResponseAnswerFilter) ([]*entities.ResponseAnswer, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
