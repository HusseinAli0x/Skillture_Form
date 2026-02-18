package interfaces

import (
	"context"

	"Skillture_Form/internal/domain/entities"

	"github.com/google/uuid"
)

// AdminUseCase defines business logic for admin operations
type AdminUseCase interface {
	Create(ctx context.Context, admin *entities.Admin) error
	GetByID(ctx context.Context, id uuid.UUID) (*entities.Admin, error)
	GetByUsername(ctx context.Context, username string) (*entities.Admin, error)
	List(ctx context.Context) ([]*entities.Admin, error)
	Delete(ctx context.Context, id uuid.UUID) error
	Authenticate(ctx context.Context, username, password string) (*entities.Admin, error)
}
