package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
		// Every other repository signals "not found" as (nil, nil). Wrapping
		// ErrNoRows here instead made a missing form indistinguishable from a
		// database failure, so handlers reported 500 for both.
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
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
	var (
		args       []interface{}
		conditions []string
	)
	if filter.Status != nil {
		args = append(args, *filter.Status)
		conditions = append(conditions, fmt.Sprintf("status = $%d", len(args)))
	}

	if filter.Title != nil {
		args = append(args, "%"+*filter.Title+"%")
		// `title` is JSONB, and Postgres has no ILIKE for jsonb — the previous
		// `title ILIKE $n` failed with:
		//   operator does not exist: jsonb ~~* unknown
		// making any title-filtered list a guaranteed 500. Match against the
		// extracted text of each translation instead.
		conditions = append(conditions, fmt.Sprintf(
			"(title->>'en' ILIKE $%d OR title->>'ar' ILIKE $%d)", len(args), len(args)))
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
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

	// A failure part-way through iteration otherwise returns a truncated
	// slice as if it were a complete, successful result.
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return forms, nil
}

// Base returns the underlying BaseRepository to allow transactional composition
func (r *FormRepository) Base() *BaseRepository {
	return r.base
}
