package interfaces

import (
	"Skillture_Form/internal/domain/entities"
	"context"

	"github.com/google/uuid"
)

// Filter object
type ResponseAnswerFilter struct {
	ResponseID *uuid.UUID
	FieldID    *uuid.UUID
}

type ResponseAnswerRepository interface {
	// Create saves a new admin
	Create(ctx context.Context, answer *entities.ResponseAnswer) error
	// Bulk insert
	CreateBulk(ctx context.Context, answers []*entities.ResponseAnswer) error
	GetByID(ctx context.Context, id uuid.UUID) (*entities.ResponseAnswer, error)
	List(ctx context.Context, filter ResponseAnswerFilter) ([]*entities.ResponseAnswer, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
