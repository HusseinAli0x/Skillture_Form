package postgres

import (
	"context"
	"fmt"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/repository/interfaces"

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

	// Convert to JSONB map
	titleMap := map[string]string{"en": form.Title}
	descMap := map[string]string{"en": form.Description}

	return r.base.Exec(ctx, query, form.ID, titleMap, descMap, form.Status)
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
	var titleMap, descMap map[string]string

	if err := row.Scan(&form.ID, &titleMap, &descMap, &form.Status, &form.CreatedAt); err != nil {
		return nil, fmt.Errorf("FormRepository.GetByID: %w", err)
	}

	form.Title = titleMap["en"]
	form.Description = descMap["en"]

	return &form, nil
}

// Update modifies an existing form
func (r *FormRepository) Update(ctx context.Context, form *entities.Form) error {
	const query = `
		UPDATE forms
		SET title=$1, description=$2, status=$3
		WHERE id=$4
	`
	titleMap := map[string]string{"en": form.Title}
	descMap := map[string]string{"en": form.Description}

	return r.base.Exec(ctx, query, titleMap, descMap, form.Status, form.ID)
}

// Delete removes a form by ID
func (r *FormRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM forms WHERE id=$1`
	return r.base.Exec(ctx, query, id)
}

// List retrieves forms ordered by creation date.
func (r *FormRepository) List(ctx context.Context, filter interfaces.FormFilter) ([]*entities.Form, error) {

	query := `
		SELECT
			id,
			title,
			description,
			status,
			created_at
		FROM forms
	`
	var args []interface{}
	// Simple query builder
	whereClause := ""

	if filter.Status != nil {
		whereClause += " WHERE status=$1"
		args = append(args, *filter.Status)
	}

	if filter.Title != nil {
		if whereClause != "" {
			whereClause += " AND title->>'en' ILIKE $" + fmt.Sprint(len(args)+1)
		} else {
			whereClause += " WHERE title->>'en' ILIKE $" + fmt.Sprint(len(args)+1)
		}
		args = append(args, "%"+*filter.Title+"%")
	}

	query += whereClause + " ORDER BY created_at DESC"

	rows, err := r.base.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("FormRepository.List: %w", err)
	}
	defer rows.Close()

	var forms []*entities.Form
	for rows.Next() {
		var f entities.Form
		var titleMap, descMap map[string]string

		if err := rows.Scan(&f.ID, &titleMap, &descMap, &f.Status, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("FormRepository.List.Scan: %w", err)
		}
		f.Title = titleMap["en"]
		f.Description = descMap["en"]
		forms = append(forms, &f)
	}

	return forms, nil
}

// Base returns the underlying BaseRepository to allow transactional composition
func (r *FormRepository) Base() *BaseRepository {
	return r.base
}
