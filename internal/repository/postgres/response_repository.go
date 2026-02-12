package postgres

import (
	"context"
	"errors"
	"fmt"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/repository/interfaces"

	"github.com/google/uuid"
)

// ResponseRepository provides PostgreSQL implementation
// for managing form responses.
// It supports transactions via BaseRepository.
type ResponseRepository struct {
	base *BaseRepository
}

// NewResponseRepository creates a new ResponseRepository instance.
func NewResponseRepository(base *BaseRepository) *ResponseRepository {
	return &ResponseRepository{base: base}
}

// WithTx executes the given function inside a database transaction.
func (r *ResponseRepository) WithTx(ctx context.Context, fn func(txRepo interfaces.ResponseRepository) error) error {
	return r.base.WithTx(ctx, func(txBase *BaseRepository) error {
		txRepo := &ResponseRepository{base: txBase}
		return fn(txRepo)
	})
}

// Create inserts a new response record.
func (r *ResponseRepository) Create(ctx context.Context, response *entities.Response) error {
	if response.ID == uuid.Nil {
		response.ID = uuid.New()
	}

	const query = `
		INSERT INTO responses (
			id,
			form_id,
			respondent,
			submitted_at
		) VALUES ($1, $2, $3, NOW())
	`

	if err := r.base.Exec(ctx, query, response.ID, response.FormID, response.Respondent); err != nil {
		return fmt.Errorf("responseRepository.Create: %w", err)
	}

	return nil
}

// GetByID retrieves a response by its ID.
func (r *ResponseRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.Response, error) {
	const query = `
		SELECT
			id,
			form_id,
			respondent,
			submitted_at
		FROM responses
		WHERE id = $1
	`

	row := r.base.QueryRow(ctx, query, id)
	var response entities.Response
	if err := row.Scan(&response.ID, &response.FormID, &response.Respondent, &response.SubmittedAt); err != nil {
		return nil, fmt.Errorf("responseRepository.GetByID: %w", err)
	}

	return &response, nil
}

// ListByFormID retrieves all responses for a specific form.
func (r *ResponseRepository) ListByFormID(ctx context.Context, formID uuid.UUID) ([]*entities.Response, error) {
	if formID == uuid.Nil {
		return nil, errors.New("responseRepository.ListByFormID: missing formID")
	}

	const query = `
		SELECT
			id,
			form_id,
			respondent,
			submitted_at
		FROM responses
		WHERE form_id = $1
		ORDER BY submitted_at DESC
	`

	rows, err := r.base.Query(ctx, query, formID)
	if err != nil {
		return nil, fmt.Errorf("responseRepository.ListByFormID: %w", err)
	}
	defer rows.Close()

	var responses []*entities.Response
	for rows.Next() {
		var response entities.Response
		if err := rows.Scan(&response.ID, &response.FormID, &response.Respondent, &response.SubmittedAt); err != nil {
			return nil, fmt.Errorf("responseRepository.ListByFormID.Scan: %w", err)
		}
		responses = append(responses, &response)
	}

	return responses, nil
}

// Delete removes a response by its ID.
func (r *ResponseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM responses WHERE id = $1`

	if err := r.base.Exec(ctx, query, id); err != nil {
		return fmt.Errorf("responseRepository.Delete: %w", err)
	}

	return nil
}
func (r *ResponseRepository) BaseRepo() *BaseRepository {
	return r.base
}
