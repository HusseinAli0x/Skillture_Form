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
	Create(ctx context.Context, response *entities.Response) error
	GetByID(ctx context.Context, id uuid.UUID) (*entities.Response, error)
	Delete(ctx context.Context, id uuid.UUID) error
	ListByFormID(ctx context.Context, formID uuid.UUID) ([]*entities.Response, error)
}
