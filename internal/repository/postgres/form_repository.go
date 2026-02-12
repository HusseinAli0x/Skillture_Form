package postgres

import (
	"context"
	"errors"
	"fmt"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/repository/interfaces"

	"github.com/google/uuid"
)

// FormsRepository provides PostgreSQL implementation
// for managing forms entity.
//
// Responsibilities:
// - Persist forms data
// - Retrieve forms records
// - Update and delete forms
//
// NOTE:
// This layer must not contain any business logic.
type FormsRepository struct {
	base *BaseRepository
}

// NewFormsRepository creates a new FormsRepository.
//
// base:
// - Shared BaseRepository
// - Handles timeout & transactions
func NewFormsRepository(base *BaseRepository) *FormsRepository {
	return &FormsRepository{base: base}
}

// Create inserts a new form record into the database.
//
// Behavior:
// - Generates UUID if missing
// - Sets created_at at DB level (recommended)
func (r *FormsRepository) Create(ctx context.Context, form *entities.Form) error {

	if form.ID == uuid.Nil {
		form.ID = uuid.New()
	}

	const query = `
		INSERT INTO forms (
			id,
			title,
			description,
			status,
			creat_at
		) VALUES ($1, $2, $3, $4, NOW())
	`

	if err := r.base.Exec(
		ctx,
		query,
		form.ID,
		form.Title,
		form.Description,
		form.Status,
	); err != nil {
		return fmt.Errorf("formsRepository.Create: %w", err)
	}

	return nil
}

// GetByID retrieves a form by its ID.
func (r *FormsRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.Form, error) {

	const query = `
		SELECT
			id,
			title,
			description,
			status,
			creat_at
		FROM forms
		WHERE id = $1
	`

	row := r.base.QueryRow(ctx, query, id)

	var form entities.Form
	if err := row.Scan(
		&form.ID,
		&form.Title,
		&form.Description,
		&form.Status,
		&form.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("formsRepository.GetByID: %w", err)
	}

	return &form, nil
}

// Update modifies an existing form.
func (r *FormsRepository) Update(ctx context.Context, form *entities.Form) error {

	if form.ID == uuid.Nil {
		return errors.New("formsRepository.Update: missing ID")
	}

	const query = `
		UPDATE forms
		SET
			title = $1,
			description = $2,
			status = $3
		WHERE id = $4
	`

	if err := r.base.Exec(
		ctx,
		query,
		form.Title,
		form.Description,
		form.Status,
		form.ID,
	); err != nil {
		return fmt.Errorf("formsRepository.Update: %w", err)
	}

	return nil
}

// Delete removes a form by ID.
func (r *FormsRepository) Delete(ctx context.Context, id uuid.UUID) error {

	const query = `
		DELETE FROM forms
		WHERE id = $1
	`

	if err := r.base.Exec(ctx, query, id); err != nil {
		return fmt.Errorf("formsRepository.Delete: %w", err)
	}

	return nil
}

// List retrieves all forms ordered by creation date.
func (r *FormsRepository) List(ctx context.Context, filter interfaces.FormFilter) ([]*entities.Form, error) {

	const query = `
		SELECT
			id,
			title,
			description,
			status,
			creat_at
		FROM forms
		ORDER BY creat_at DESC
	`

	rows, err := r.base.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("formsRepository.List: %w", err)
	}
	defer rows.Close()

	var forms []*entities.Form

	for rows.Next() {
		var form entities.Form
		if err := rows.Scan(
			&form.ID,
			&form.Title,
			&form.Description,
			&form.Status,
			&form.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("formsRepository.List.Scan: %w", err)
		}

		forms = append(forms, &form)
	}

	return forms, nil
}
