package postgres

import (
	"context"
	"errors"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
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
	var typeStr string

	err := row.Scan(
		&ff.ID,
		&ff.FormID,
		&ff.Label,
		&typeStr,
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

	// Map string to enum using centralized parser
	ff.Type = enums.ParseFieldType(typeStr)
	if !ff.Type.IsValid() {
		ff.Type = enums.FieldTypeText // fallback
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
			(id, form_id, label, type, position, is_required, placeholder, help_text, options, created_at, updated_at)
		VALUES
			($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
	`

	// Map enum to string for DB using centralized method
	typeStr := ff.Type.String()

	return r.Exec(ctx, query,
		ff.ID,
		ff.FormID,
		ff.Label,
		typeStr,
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
		SELECT id, form_id, label, type, position, is_required, placeholder, help_text, options, created_at, updated_at
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
		    position = $4,
		    is_required = $5,
		    placeholder = $6,
		    help_text = $7,
		    options = $8,
		    updated_at = NOW()
		WHERE id = $1
	`

	// Map enum to string
	var typeStr string
	switch ff.Type {
	case 1:
		typeStr = "text"
	case 2:
		typeStr = "textarea"
	case 3:
		typeStr = "number"
	case 4:
		typeStr = "email"
	case 5:
		typeStr = "select"
	case 6:
		typeStr = "radio"
	case 7:
		typeStr = "checkbox"
	case 8:
		typeStr = "date"
	default:
		typeStr = "text"
	}

	tag, err := r.exec.Exec(ctx, query,
		ff.ID,
		ff.Label,
		typeStr,
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
		SELECT id, form_id, label, type, position, is_required, placeholder, help_text, options, created_at, updated_at
		FROM form_fields
	`
	var rows pgx.Rows
	var err error

	if filter.FormID != nil {
		query := baseQuery + " WHERE form_id = $1 ORDER BY position ASC"
		rows, err = r.Query(ctx, query, *filter.FormID)
	} else {
		query := baseQuery + " ORDER BY position ASC"
		rows, err = r.Query(ctx, query)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fields []*entities.FormField
	for rows.Next() {
		var ff entities.FormField
		var typeStr string
		err := rows.Scan(
			&ff.ID,
			&ff.FormID,
			&ff.Label,
			&typeStr,
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

		// Map string to enum
		switch typeStr {
		case "text":
			ff.Type = 1
		case "textarea":
			ff.Type = 2
		case "number":
			ff.Type = 3
		case "email":
			ff.Type = 4
		case "select":
			ff.Type = 5
		case "radio":
			ff.Type = 6
		case "checkbox":
			ff.Type = 7
		case "date":
			ff.Type = 8
		default:
			ff.Type = 1
		}

		fields = append(fields, &ff)
	}

	return fields, nil
}
