package postgres

import (
	"context"
	"errors"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/repository/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// formFieldRepository implements interfaces.FormFieldRepository
type formFieldRepository struct {
	*BaseRepository
}

// Compile-time check
var _ interfaces.FormFieldRepository = (*formFieldRepository)(nil)

// NewFormFieldRepository creates a new FormFieldRepository instance
func NewFormFieldRepository(base *BaseRepository) interfaces.FormFieldRepository {
	return &formFieldRepository{
		BaseRepository: base,
	}
}

// scanFormField scans a single row into entities.FormField
func scanFormField(row pgx.Row) (*entities.FormField, error) {
	var ff entities.FormField
	err := row.Scan(
		&ff.ID,
		&ff.FormID,
		&ff.Label,
		&ff.Type,
		&ff.FieldOrder,
		&ff.Required,
		&ff.Placeholder,
		&ff.HelpText,
		&ff.Options,
		&ff.CreatedAt,
		&ff.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &ff, nil
}

// Create inserts a new form field
func (r *formFieldRepository) Create(ctx context.Context, ff *entities.FormField) error {
	if ff.ID == uuid.Nil {
		ff.ID = uuid.New()
	}

	query := `
		INSERT INTO form_fields
			(id, form_id, label, type, field_order, required, placeholder, help_text, options, created_at, updated_at)
		VALUES
			($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
	`

	return r.Exec(ctx, query,
		ff.ID,
		ff.FormID,
		ff.Label,
		ff.Type,
		ff.FieldOrder,
		ff.Required,
		ff.Placeholder,
		ff.HelpText,
		ff.Options,
	)
}

// GetByID retrieves a form field by ID
func (r *formFieldRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.FormField, error) {
	query := `
		SELECT id, form_id, label, type, field_order, required, placeholder, help_text, options, created_at, updated_at
		FROM form_fields
		WHERE id = $1
	`

	ff, err := scanFormField(r.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return ff, err
}

// Update modifies an existing form field
func (r *formFieldRepository) Update(ctx context.Context, ff *entities.FormField) error {
	query := `
		UPDATE form_fields
		SET label = $2,
		    type = $3,
		    field_order = $4,
		    required = $5,
		    placeholder = $6,
		    help_text = $7,
		    options = $8,
		    updated_at = NOW()
		WHERE id = $1
	`

	tag, err := r.exec.Exec(ctx, query,
		ff.ID,
		ff.Label,
		ff.Type,
		ff.FieldOrder,
		ff.Required,
		ff.Placeholder,
		ff.HelpText,
		ff.Options,
	)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// Delete removes a form field by ID
func (r *formFieldRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM form_fields WHERE id = $1`

	tag, err := r.exec.Exec(ctx, query, id)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// List returns all form fields, optionally filtered by form ID
func (r *formFieldRepository) List(ctx context.Context, filter interfaces.FormFieldFilter) ([]*entities.FormField, error) {
	baseQuery := `
		SELECT id, form_id, label, type, field_order, required, placeholder, help_text, options, created_at, updated_at
		FROM form_fields
	`
	var rows pgx.Rows
	var err error

	if filter.FormID != nil {
		query := baseQuery + " WHERE form_id = $1 ORDER BY field_order ASC"
		rows, err = r.Query(ctx, query, *filter.FormID)
	} else {
		query := baseQuery + " ORDER BY field_order ASC"
		rows, err = r.Query(ctx, query)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fields []*entities.FormField
	for rows.Next() {
		var ff entities.FormField
		err := rows.Scan(
			&ff.ID,
			&ff.FormID,
			&ff.Label,
			&ff.Type,
			&ff.FieldOrder,
			&ff.Required,
			&ff.Placeholder,
			&ff.HelpText,
			&ff.Options,
			&ff.CreatedAt,
			&ff.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		fields = append(fields, &ff)
	}

	return fields, nil
}
