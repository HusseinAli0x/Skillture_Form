package interfaces

import (
	"Skillture_Form/internal/domain/entities"
	"context"

	"github.com/google/uuid"
)

type ResponseAnswerVectorFilter struct {
	ResponseAnswerID *uuid.UUID
	ModelName        *string
}

type ResponseAnswerVectorRepository interface {
	Create(ctx context.Context, vector *entities.ResponseAnswerVector) error
	CreateBulk(ctx context.Context, vectors []*entities.ResponseAnswerVector) error
	GetByID(ctx context.Context, id uuid.UUID) (*entities.ResponseAnswerVector, error)
	List(ctx context.Context, filter ResponseAnswerVectorFilter) ([]*entities.ResponseAnswerVector, error)
	Delete(ctx context.Context, id uuid.UUID) error
	// WithTxRepo creates a repository instance bound to the given transaction
	WithTxRepo(txRepo ResponseRepository) ResponseAnswerVectorRepository
}
