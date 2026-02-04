package postgres

import (
	"context"
	"errors"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/repository/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// adminRepository implements interfaces.AdminRepository using PostgreSQL.
type adminRepository struct {
	*BaseRepository
}

// Ensure compile-time that adminRepository implements AdminRepository
var _ interfaces.AdminRepository = (*adminRepository)(nil)

// NewAdminRepository creates a new AdminRepository instance.
func NewAdminRepository(base *BaseRepository) interfaces.AdminRepository {
	return &adminRepository{
		BaseRepository: base,
	}
}

// scanAdmin scans a single row into entities.Admin
func scanAdmin(row pgx.Row) (*entities.Admin, error) {
	var admin entities.Admin
	err := row.Scan(
		&admin.ID,
		&admin.Username,
		&admin.HashedPassword,
		&admin.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &admin, nil
}

// Create inserts a new admin into the database
func (r *adminRepository) Create(ctx context.Context, admin *entities.Admin) error {
	if admin.ID == uuid.Nil {
		admin.ID = uuid.New()
	}

	query := `
		INSERT INTO admins (id, username, hashed_password, created_at)
		VALUES ($1, $2, $3, NOW())
	`

	return r.Exec(ctx, query, admin.ID, admin.Username, admin.HashedPassword)
}

// GetByID retrieves an admin by ID
func (r *adminRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.Admin, error) {
	query := `
		SELECT id, username, hashed_password, created_at
		FROM admins
		WHERE id = $1
	`

	admin, err := scanAdmin(r.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}

	return admin, err
}

// GetByUsername retrieves an admin by username
func (r *adminRepository) GetByUsername(ctx context.Context, username string) (*entities.Admin, error) {
	query := `
		SELECT id, username, hashed_password, created_at
		FROM admins
		WHERE username = $1
	`

	admin, err := scanAdmin(r.QueryRow(ctx, query, username))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}

	return admin, err
}

// Update modifies an existing admin
func (r *adminRepository) Update(ctx context.Context, admin *entities.Admin) error {
	query := `
		UPDATE admins
		SET username = $2,
		    hashed_password = $3
		WHERE id = $1
	`

	tag, err := r.exec.Exec(ctx, query, admin.ID, admin.Username, admin.HashedPassword)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	return nil
}

// Delete removes an admin by ID
func (r *adminRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM admins WHERE id = $1`

	tag, err := r.exec.Exec(ctx, query, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	return nil
}

// List returns all admins
func (r *adminRepository) List(ctx context.Context) ([]*entities.Admin, error) {
	query := `
		SELECT id, username, hashed_password, created_at
		FROM admins
		ORDER BY created_at DESC
	`

	rows, err := r.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var admins []*entities.Admin
	for rows.Next() {
		var admin entities.Admin
		err := rows.Scan(&admin.ID, &admin.Username, &admin.HashedPassword, &admin.CreatedAt)
		if err != nil {
			return nil, err
		}
		admins = append(admins, &admin)
	}

	return admins, nil
}
