package postgres

import (
	"context"
	"fmt"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	"Skillture_Form/internal/repository/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ResponseAnswerRepository implements Postgres CRUD operations for response answers.
type ResponseAnswerRepository struct {
	base *BaseRepository
}

// NewResponseAnswerRepository creates a new instance of ResponseAnswerRepository
func NewResponseAnswerRepository(base *BaseRepository) *ResponseAnswerRepository {
	return &ResponseAnswerRepository{base: base}
}

// scanResponseAnswer scans a row into ResponseAnswer
func scanResponseAnswer(row pgx.Row) (*entities.ResponseAnswer, error) {
	var a entities.ResponseAnswer
	err := row.Scan(
		&a.ID,
		&a.ResponseID,
		&a.FieldID,
		&a.Value,
		&a.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// WithTx executes operations in a transaction.
func (r *ResponseAnswerRepository) WithTx(
	ctx context.Context,
	fn func(txRepo interfaces.ResponseAnswerRepository) error,
) error {
	return r.base.WithTx(ctx, func(txBase *BaseRepository) error {
		txRepo := &ResponseAnswerRepository{base: txBase}
		return fn(txRepo)
	})
}

// Create inserts a single response answer
func (r *ResponseAnswerRepository) Create(ctx context.Context, answer *entities.ResponseAnswer) error {
	if answer.ID == uuid.Nil {
		answer.ID = uuid.New()
	}

	const query = `
		INSERT INTO response_answers (
			id,
			response_id,
			field_id,
			field_type,
			value,
			created_at
		) VALUES ($1, $2, $3, $4, $5, NOW())
	`

	return r.base.Exec(ctx, query,
		answer.ID,
		answer.ResponseID,
		answer.FieldID,
		answer.FieldType.String(),
		answer.Value,
	)
}

// CreateBulk inserts multiple answers in one operation
func (r *ResponseAnswerRepository) CreateBulk(ctx context.Context, answers []*entities.ResponseAnswer) error {
	if len(answers) == 0 {
		return nil
	}

	for _, a := range answers {
		if a.ID == uuid.Nil {
			a.ID = uuid.New()
		}
	}

	const query = `
		INSERT INTO response_answers (
			id, response_id, field_id, field_type, value, created_at
		) VALUES ($1,$2,$3,$4,$5,NOW())
	`

	for _, a := range answers {
		if err := r.base.Exec(ctx, query, a.ID, a.ResponseID, a.FieldID, a.FieldType.String(), a.Value); err != nil {
			return fmt.Errorf("CreateBulk: %w", err)
		}
	}

	return nil
}

// GetByID retrieves a single response answer by ID
func (r *ResponseAnswerRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.ResponseAnswer, error) {
	const query = `
		SELECT id, response_id, field_id, field_type, value, created_at
		FROM response_answers
		WHERE id=$1
	`

	row := r.base.QueryRow(ctx, query, id)
	var ans entities.ResponseAnswer
	var fieldTypeStr string
	if err := row.Scan(&ans.ID, &ans.ResponseID, &ans.FieldID, &fieldTypeStr, &ans.Value, &ans.CreatedAt); err != nil {
		return nil, fmt.Errorf("GetByID: %w", err)
	}
	ans.FieldType = enums.ParseFieldType(fieldTypeStr)

	return &ans, nil
}

// List retrieves answers by filter (ResponseID or FieldID)
func (r *ResponseAnswerRepository) List(ctx context.Context, filter interfaces.ResponseAnswerFilter) ([]*entities.ResponseAnswer, error) {
	query := `
		SELECT id, response_id, field_id, field_type, value, created_at
		FROM response_answers
		WHERE 1=1
	`
	var args []interface{}
	argPos := 1

	if filter.ResponseID != nil {
		query += fmt.Sprintf(" AND response_id=$%d", argPos)
		args = append(args, *filter.ResponseID)
		argPos++
	}

	if filter.FieldID != nil {
		query += fmt.Sprintf(" AND field_id=$%d", argPos)
		args = append(args, *filter.FieldID)
		argPos++
	}

	rows, err := r.base.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("List: %w", err)
	}
	defer rows.Close()

	var answers []*entities.ResponseAnswer
	for rows.Next() {
		var a entities.ResponseAnswer
		var fieldTypeStr string
		if err := rows.Scan(&a.ID, &a.ResponseID, &a.FieldID, &fieldTypeStr, &a.Value, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("List.Scan: %w", err)
		}
		a.FieldType = enums.ParseFieldType(fieldTypeStr)
		answers = append(answers, &a)
	}

	return answers, nil
}

// Delete removes an answer by ID
func (r *ResponseAnswerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM response_answers WHERE id=$1`
	return r.base.Exec(ctx, query, id)
}

// Base returns the underlying BaseRepository for transactional use
func (r *ResponseAnswerRepository) Base() *BaseRepository {
	return r.base
}
