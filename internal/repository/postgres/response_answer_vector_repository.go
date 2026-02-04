package postgres

import (
	"context"
	"errors"
	"fmt"

	"Skillture_Form/internal/domain/entities"

	"github.com/google/uuid"
)

// ResponseAnswerVectorRepository provides PostgreSQL implementation
// for storing and retrieving vector embeddings related to response answers.
//
// Responsibilities:
// - Persist vector embeddings
// - Retrieve embeddings by ID or ResponseAnswerID
// - Delete embeddings when needed
//
// NOTE:
// This repository contains NO business logic.
type ResponseAnswerVectorRepository struct {
	base *BaseRepository
}

// NewResponseAnswerVectorRepository creates a new repository instance.
//
// base:
// - Shared BaseRepository
// - Handles timeout enforcement and transactions
func NewResponseAnswerVectorRepository(base *BaseRepository) *ResponseAnswerVectorRepository {
	return &ResponseAnswerVectorRepository{base: base}
}

// Create inserts a new response answer vector into the database.
//
// Behavior:
// - Generates UUID if missing
// - Stores embedding vector (e.g. pgvector)
func (r *ResponseAnswerVectorRepository) Create(ctx context.Context, vector *entities.ResponseAnswerVector) error {

	if vector.ID == uuid.Nil {
		vector.ID = uuid.New()
	}

	const query = `
		INSERT INTO response_answer_vectors (
			id,
			response_answer_id,
			embedding,
			model_name,
			created_at
		) VALUES ($1, $2, $3, $4, NOW())
	`

	if err := r.base.Exec(
		ctx,
		query,
		vector.ID,
		vector.ResponseAnswerID,
		vector.Embedding,
		vector.ModelName,
	); err != nil {
		return fmt.Errorf("responseAnswerVectorRepository.Create: %w", err)
	}

	return nil
}

// GetByID retrieves a vector embedding by its ID.
func (r *ResponseAnswerVectorRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.ResponseAnswerVector, error) {

	const query = `
		SELECT
			id,
			response_answer_id,
			embedding,
			model_name,
			created_at
		FROM response_answer_vectors
		WHERE id = $1
	`

	row := r.base.QueryRow(ctx, query, id)

	var vector entities.ResponseAnswerVector
	if err := row.Scan(
		&vector.ID,
		&vector.ResponseAnswerID,
		&vector.Embedding,
		&vector.ModelName,
		&vector.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("responseAnswerVectorRepository.GetByID: %w", err)
	}

	return &vector, nil
}

// GetByResponseAnswerID retrieves the vector associated
// with a specific response answer.
//
// Assumption:
// - One vector per response answer
func (r *ResponseAnswerVectorRepository) GetByResponseAnswerID(
	ctx context.Context, responseAnswerID uuid.UUID) (*entities.ResponseAnswerVector, error) {

	const query = `
		SELECT
			id,
			response_answer_id,
			embedding,
			model_name,
			created_at
		FROM response_answer_vectors
		WHERE response_answer_id = $1
	`

	row := r.base.QueryRow(ctx, query, responseAnswerID)

	var vector entities.ResponseAnswerVector
	if err := row.Scan(
		&vector.ID,
		&vector.ResponseAnswerID,
		&vector.Embedding,
		&vector.ModelName,
		&vector.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("responseAnswerVectorRepository.GetByResponseAnswerID: %w", err)
	}

	return &vector, nil
}

// Delete removes a vector embedding by its ID.
func (r *ResponseAnswerVectorRepository) Delete(ctx context.Context, id uuid.UUID) error {

	const query = `
		DELETE FROM response_answer_vectors
		WHERE id = $1
	`

	if err := r.base.Exec(ctx, query, id); err != nil {
		return fmt.Errorf("responseAnswerVectorRepository.Delete: %w", err)
	}

	return nil
}

// DeleteByResponseAnswerID removes vector embedding
// associated with a specific response answer.
func (r *ResponseAnswerVectorRepository) DeleteByResponseAnswerID(ctx context.Context, responseAnswerID uuid.UUID) error {

	if responseAnswerID == uuid.Nil {
		return errors.New("responseAnswerVectorRepository.DeleteByResponseAnswerID: missing responseAnswerID")
	}

	const query = `
		DELETE FROM response_answer_vectors
		WHERE response_answer_id = $1
	`

	if err := r.base.Exec(ctx, query, responseAnswerID); err != nil {
		return fmt.Errorf("responseAnswerVectorRepository.DeleteByResponseAnswerID: %w", err)
	}

	return nil
}
