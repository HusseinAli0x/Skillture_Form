package postgres

import (
	"context"
	"errors"
	"fmt"

	"Skillture_Form/internal/domain/entities"

	"github.com/google/uuid"
)

// ResponseRepository provides PostgreSQL implementation
// for managing form responses.
//
// Responsibilities:
// - Store form submissions
// - Retrieve responses
// - Handle JSONB respondent data
//
// NOTE:
// This repository must NOT contain business logic.
type ResponseRepository struct {
	base *BaseRepository
}

// NewResponseRepository creates a new ResponseRepository instance.
//
// base:
// - Shared BaseRepository
// - Handles timeout & transaction support
func NewResponseRepository(base *BaseRepository) *ResponseRepository {
	return &ResponseRepository{base: base}
}

// Create inserts a new response record.
//
// Behavior:
// - Generates UUID if missing
// - submitted_at is set by database (NOW())
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

	if err := r.base.Exec(
		ctx,
		query,
		response.ID,
		response.FormID,
		response.Respondent,
	); err != nil {
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
	if err := row.Scan(
		&response.ID,
		&response.FormID,
		&response.Respondent,
		&response.SubmittedAt,
	); err != nil {
		return nil, fmt.Errorf("responseRepository.GetByID: %w", err)
	}

	return &response, nil
}

// ListByFormID retrieves all responses for a specific form.
//
// Results are ordered by submission time (latest first).
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
		if err := rows.Scan(
			&response.ID,
			&response.FormID,
			&response.Respondent,
			&response.SubmittedAt,
		); err != nil {
			return nil, fmt.Errorf("responseRepository.ListByFormID.Scan: %w", err)
		}

		responses = append(responses, &response)
	}

	return responses, nil
}

// Delete removes a response by its ID.
func (r *ResponseRepository) Delete(ctx context.Context, id uuid.UUID) error {

	const query = `
		DELETE FROM responses
		WHERE id = $1
	`

	if err := r.base.Exec(ctx, query, id); err != nil {
		return fmt.Errorf("responseRepository.Delete: %w", err)
	}

	return nil
}
