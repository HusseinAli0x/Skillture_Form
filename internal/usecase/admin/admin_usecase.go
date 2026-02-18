package admin

import (
	"context"
	"errors"
	"time"

	"Skillture_Form/internal/domain/entities"
	repo "Skillture_Form/internal/repository/interfaces"
	uc "Skillture_Form/internal/usecase/interfaces"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type adminUseCase struct {
	adminRepo repo.AdminRepository
}

// NewAdminUseCase creates a new AdminUseCase
func NewAdminUseCase(adminRepo repo.AdminRepository) uc.AdminUseCase {
	return &adminUseCase{
		adminRepo: adminRepo,
	}
}

// Create creates a new admin with hashed password
func (u *adminUseCase) Create(ctx context.Context, admin *entities.Admin) error {
	// Check if username already exists
	existing, _ := u.adminRepo.GetByUsername(ctx, admin.Username)
	if existing != nil {
		return errors.New("username already exists")
	}

	// Generate ID if missing
	if admin.ID == uuid.Nil {
		admin.ID = uuid.New()
	}

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(admin.HashedPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	admin.HashedPassword = string(hashed)

	admin.CreatedAt = time.Now()

	return u.adminRepo.Create(ctx, admin)
}

func (u *adminUseCase) GetByID(ctx context.Context, id uuid.UUID) (*entities.Admin, error) {
	return u.adminRepo.GetByID(ctx, id)
}

func (u *adminUseCase) GetByUsername(ctx context.Context, username string) (*entities.Admin, error) {
	return u.adminRepo.GetByUsername(ctx, username)
}

func (u *adminUseCase) List(ctx context.Context) ([]*entities.Admin, error) {
	return u.adminRepo.List(ctx)
}

func (u *adminUseCase) Delete(ctx context.Context, id uuid.UUID) error {
	return u.adminRepo.Delete(ctx, id)
}

// Authenticate validates an admin login attempt
func (u *adminUseCase) Authenticate(ctx context.Context, username, password string) (*entities.Admin, error) {
	admin, err := u.adminRepo.GetByUsername(ctx, username)
	if err != nil {
		return nil, errors.New("invalid username or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.HashedPassword), []byte(password)); err != nil {
		return nil, errors.New("invalid username or password")
	}

	return admin, nil
}
