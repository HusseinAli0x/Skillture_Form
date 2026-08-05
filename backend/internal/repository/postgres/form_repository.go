package postgres

import (
	"context"
	"encoding/json"
	"fmt"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
)

// FormRepository implements Postgres CRUD operations for forms.
// It supports transactions via BaseRepository.
//
// Responsibilities:
// - Create, Read, Update, Delete forms
// - List forms based on optional filters
// - Execute operations inside a transaction if needed
type FormRepository struct {
	base *BaseRepository
}

// NewFormRepository creates a new FormRepository instance
func NewFormRepository(base *BaseRepository) *FormRepository {
	return &FormRepository{base: base}
}

// WithTx executes a function within a database transaction.
// This allows multiple operations to be committed/rolled back atomically.
func (r *FormRepository) WithTx(ctx context.Context, fn func(txRepo *FormRepository) error) error {
	return r.base.WithTx(ctx, func(txBase *BaseRepository) error {
		txRepo := &FormRepository{base: txBase}
		return fn(txRepo)
	})
}

// Create inserts a new form into the database
func (r *FormRepository) Create(ctx context.Context, form *entities.Form) error {
	if form.ID == uuid.Nil {
		form.ID = uuid.New()
	}

	const query = `
		INSERT INTO forms (id, title, description, status, created_at)
		VALUES ($1, $2, $3, $4, NOW())
	`

	titleBytes, _ := json.Marshal(form.Title)
	descBytes, _ := json.Marshal(form.Description)

	return r.base.Exec(ctx, query, form.ID, titleBytes, descBytes, form.Status)
}

// GetByID retrieves a form by its ID
func (r *FormRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.Form, error) {
	const query = `
		SELECT id, title, description, status, created_at
		FROM forms
		WHERE id=$1
	`

	row := r.base.QueryRow(ctx, query, id)
	var form entities.Form
	var titleBytes, descBytes []byte
	if err := row.Scan(&form.ID, &titleBytes, &descBytes, &form.Status, &form.CreatedAt); err != nil {
		return nil, fmt.Errorf("FormRepository.GetByID: %w", err)
	}

	if len(titleBytes) > 0 {
		_ = json.Unmarshal(titleBytes, &form.Title)
	}
	if len(descBytes) > 0 {
		_ = json.Unmarshal(descBytes, &form.Description)
	}

	return &form, nil
}

// Update modifies an existing form
func (r *FormRepository) Update(ctx context.Context, form *entities.Form) error {
	const query = `
		UPDATE forms
		SET title=$1, description=$2, status=$3
		WHERE id=$4
	`
	titleBytes, _ := json.Marshal(form.Title)
	descBytes, _ := json.Marshal(form.Description)
	return r.base.Exec(ctx, query, titleBytes, descBytes, form.Status, form.ID)
}

// Delete removes a form by ID
func (r *FormRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM forms WHERE id=$1`
	return r.base.Exec(ctx, query, id)
}

// List retrieves forms based on optional filters
func (r *FormRepository) List(ctx context.Context, filter interfaces.FormFilter) ([]*entities.Form, error) {
	query := `
		SELECT id, title, description, status, created_at
		FROM forms
	`
	var args []interface{}
	if filter.Status != nil {
		query += " WHERE status=$1"
		args = append(args, *filter.Status)
	}

	if filter.Title != nil {
		if len(args) > 0 {
			query += " AND title ILIKE $2"
		} else {
			query += " WHERE title ILIKE $1"
		}
		args = append(args, "%"+*filter.Title+"%")
	}

	rows, err := r.base.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("FormRepository.List: %w", err)
	}
	defer rows.Close()

	var forms []*entities.Form
	for rows.Next() {
		var f entities.Form
		var titleBytes, descBytes []byte
		if err := rows.Scan(&f.ID, &titleBytes, &descBytes, &f.Status, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("FormRepository.List.Scan: %w", err)
		}
		if len(titleBytes) > 0 {
			_ = json.Unmarshal(titleBytes, &f.Title)
		}
		if len(descBytes) > 0 {
			_ = json.Unmarshal(descBytes, &f.Description)
		}
		forms = append(forms, &f)
	}

	return forms, nil
}

// Base returns the underlying BaseRepository to allow transactional composition
func (r *FormRepository) Base() *BaseRepository {
	return r.base
}
