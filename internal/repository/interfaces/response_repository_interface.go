package interfaces

import (
	"Skillture_Form/internal/domain/entities"
	"context"

	"github.com/google/uuid"
)

type ResponseFilter struct {
	FormID *uuid.UUID
	Email  *string
}

type ResponseRepository interface {
	Create(ctx context.Context, tx Transaction, response *entities.Response) error
	GetByID(ctx context.Context, tx Transaction, id uuid.UUID) (*entities.Response, error)
	Delete(ctx context.Context, tx Transaction, id uuid.UUID) error
	ListByFormID(ctx context.Context, tx Transaction, formID uuid.UUID) ([]*entities.Response, error)
}
