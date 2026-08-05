package admin

import (
	"context"
	"errors"
	"log"
	"time"

	"skillture/backend/internal/domain/entities"
	repo "skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// AdminUseCase is the exported struct for admin business logic
type AdminUseCase struct {
	adminRepo repo.AdminRepository
}

// NewAdminUseCase creates a new instance of AdminUseCase
func NewAdminUseCase(adminRepo repo.AdminRepository) *AdminUseCase {
	return &AdminUseCase{adminRepo: adminRepo}
}

// Create creates a new admin with username and password
func (uc *AdminUseCase) Create(ctx context.Context, username, password string) (*entities.Admin, error) {
	if username == "" || password == "" {
		return nil, errors.New("username and password are required")
	}

	// Example password hash (replace with bcrypt in production)
	hashed := HashPassword(password)

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
		log.Printf("CheckPassword failed for %s. Expected hash %s, got %s", username, admin.HashedPassword, HashPassword(password))
		return nil, errors.New("invalid username or password")
	}

	return admin, nil
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
// HashPassword hashes a password using bcrypt
func HashPassword(password string) string {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		log.Printf("Failed to hash password: %v", err)
		return ""
	}
	return string(bytes)
}

// CheckPassword compares plain password with hashed password
func CheckPassword(password, hashed string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password))
	return err == nil
}
