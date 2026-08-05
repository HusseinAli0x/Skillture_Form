package postgres

import (
	"context"
	"errors"
	"fmt"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ResponseRepository implements PostgreSQL operations for Responses
// It supports transactional operations involving responses, answers, and vectors.
type ResponseRepository struct {
	base *BaseRepository
}

// NewResponseRepository creates a new instance of ResponseRepository
func NewResponseRepository(base *BaseRepository) *ResponseRepository {
	return &ResponseRepository{base: base}
}

// WithTx runs the given function inside a transaction.
// It provides transactional repositories for Response, ResponseAnswer, and ResponseAnswerVector.
func (r *ResponseRepository) WithTx(
	ctx context.Context,
	fn func(
		responseRepo interfaces.ResponseRepository,
		answerRepo interfaces.ResponseAnswerRepository,
		vectorRepo interfaces.ResponseAnswerVectorRepository,
	) error,
) error {
	return r.base.WithTx(ctx, func(txBase *BaseRepository) error {
		return fn(
			NewResponseRepository(txBase),
			NewResponseAnswerRepository(txBase),
			NewResponseAnswerVectorRepository(txBase),
		)
	})
}

// Create inserts a new response
func (r *ResponseRepository) Create(ctx context.Context, response *entities.Response) error {
	if response.ID == uuid.Nil {
		response.ID = uuid.New()
	}

	const query = `
		INSERT INTO responses (
			id, form_id, respondent, status, submitted_at
		) VALUES ($1, $2, $3, $4, $5)
	`

	return r.base.Exec(ctx, query, response.ID, response.FormID, response.Respondent, response.Status, response.SubmittedAt)
}

// GetByID retrieves a response by ID
func (r *ResponseRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.Response, error) {
	const query = `
		SELECT id, form_id, respondent, status, submitted_at
		FROM responses
		WHERE id=$1
	`

	row := r.base.QueryRow(ctx, query, id)
	var resp entities.Response
	if err := row.Scan(&resp.ID, &resp.FormID, &resp.Respondent, &resp.Status, &resp.SubmittedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("GetByID: %w", err)
	}

	return &resp, nil
}

// ListByFormID lists all responses of a form
func (r *ResponseRepository) ListByFormID(ctx context.Context, formID uuid.UUID) ([]*entities.Response, error) {
	const query = `
		SELECT id, form_id, respondent, status, submitted_at
		FROM responses
		WHERE form_id=$1
		ORDER BY submitted_at DESC
	`

	rows, err := r.base.Query(ctx, query, formID)
	if err != nil {
		return nil, fmt.Errorf("ListByFormID: %w", err)
	}
	defer rows.Close()

	var responses []*entities.Response
	for rows.Next() {
		var resp entities.Response
		if err := rows.Scan(&resp.ID, &resp.FormID, &resp.Respondent, &resp.Status, &resp.SubmittedAt); err != nil {
			return nil, fmt.Errorf("ListByFormID.Scan: %w", err)
		}
		responses = append(responses, &resp)
	}

	// A failure part-way through iteration otherwise returns a truncated
	// slice as if it were a complete, successful result.
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return responses, nil
}

// Delete removes a response by ID
func (r *ResponseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM responses WHERE id=$1`
	return r.base.Exec(ctx, query, id)
}

// Base returns the underlying BaseRepository
func (r *ResponseRepository) Base() *BaseRepository {
	return r.base
}
