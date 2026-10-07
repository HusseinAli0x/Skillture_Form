package admin

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"skillture/backend/internal/domain/entities"
	repo "skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// AdminUseCase is the exported struct for admin business logic
type AdminUseCase struct {
	adminRepo  repo.AdminRepository
	bcryptCost int
}

// NewAdminUseCase creates a new instance of AdminUseCase.
// bcryptCost comes from configuration; values outside bcrypt's supported range
// fall back to the library default.
func NewAdminUseCase(adminRepo repo.AdminRepository, bcryptCost int) *AdminUseCase {
	if bcryptCost < bcrypt.MinCost || bcryptCost > bcrypt.MaxCost {
		bcryptCost = bcrypt.DefaultCost
	}
	return &AdminUseCase{adminRepo: adminRepo, bcryptCost: bcryptCost}
}

// Create creates a new admin with username and password
func (uc *AdminUseCase) Create(ctx context.Context, username, password string) (*entities.Admin, error) {
	if username == "" || password == "" {
		return nil, errors.New("username and password are required")
	}

	// A hashing failure must abort the create. The previous helper returned ""
	// on error and the empty string was stored as the password hash.
	hashed, err := HashPassword(password, uc.bcryptCost)
	if err != nil {
		return nil, err
	}

	admin := &entities.Admin{
		ID:             uuid.New(),
		Username:       username,
		HashedPassword: hashed,
		CreatedAt:      time.Now(),
	}

	if err := uc.adminRepo.Create(ctx, admin); err != nil {
		return nil, err
	}

	return admin, nil
}

// Authenticate validates an admin login attempt
func (uc *AdminUseCase) Authenticate(ctx context.Context, username, password string) (*entities.Admin, error) {
	admin, err := uc.adminRepo.GetByUsername(ctx, username)
	if err != nil {
		log.Printf("GetByUsername error for %s: %v", username, err)
		return nil, errors.New("invalid username or password")
	}
	if admin == nil {
		log.Printf("GetByUsername returned nil admin for %s", username)
		return nil, errors.New("invalid username or password")
	}

	if !CheckPassword(password, admin.HashedPassword) {
		// Never log the stored hash or a hash of the attempted password —
		// that is password material in the application log.
		log.Printf("Failed password check for %s", username)
		return nil, errors.New("invalid username or password")
	}

	return admin, nil
}

// GetByID retrieves a single admin by ID. Returns (nil, nil) when not found.
func (uc *AdminUseCase) GetByID(ctx context.Context, id uuid.UUID) (*entities.Admin, error) {
	return uc.adminRepo.GetByID(ctx, id)
}

// List retrieves all admins
func (uc *AdminUseCase) List(ctx context.Context) ([]*entities.Admin, error) {
	return uc.adminRepo.List(ctx)
}

// Delete removes an admin by ID
func (uc *AdminUseCase) Delete(ctx context.Context, id uuid.UUID) error {
	return uc.adminRepo.Delete(ctx, id)
}

// --- Helper functions ---
// HashPassword hashes a password using bcrypt at the given cost.
func HashPassword(password string, cost int) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(bytes), nil
}

// CheckPassword compares plain password with hashed password
func CheckPassword(password, hashed string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password))
	return err == nil
}
