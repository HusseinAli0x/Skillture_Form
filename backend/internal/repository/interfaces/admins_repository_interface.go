package interfaces

import (
	"skillture/backend/internal/domain/entities"
	"context"

	"github.com/google/uuid"
)

// AdminRepository
type AdminRepository interface {
	// Create saves a new admin
	Create(ctx context.Context, admin *entities.Admin) error
	// GetByID retrieves an admin by their ID
	GetByID(ctx context.Context, id uuid.UUID) (*entities.Admin, error)
	// GetByUsername retrieves an admin by username (unique)
	GetByUsername(ctx context.Context, username string) (*entities.Admin, error)
	// Update modifies admin details
	Update(ctx context.Context, admin *entities.Admin) error
	// Delete removes an admin
	Delete(ctx context.Context, id uuid.UUID) error
	// List retrieves all admins (simple list, no filters yet)
	List(ctx context.Context) ([]*entities.Admin, error) // simple list, no filter yet
}
