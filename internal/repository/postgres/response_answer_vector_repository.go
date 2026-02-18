package postgres

import (
	"context"
	"fmt"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/repository/interfaces"

	"github.com/google/uuid"
)

// ResponseAnswerVectorRepository implements Postgres CRUD for embeddings/vectors
// Responsibilities:
// - Create single or bulk vectors
// - Retrieve vectors by ID or filter
// - Delete vectors
// - Supports transactions via BaseRepository
type ResponseAnswerVectorRepository struct {
	base *BaseRepository
}

// NewResponseAnswerVectorRepository creates a new repository instance
func NewResponseAnswerVectorRepository(base *BaseRepository) *ResponseAnswerVectorRepository {
	return &ResponseAnswerVectorRepository{base: base}
}

// WithTx executes operations in a transaction.
// Allows combining multiple repositories atomically.
func (r *ResponseAnswerVectorRepository) WithTx(
	ctx context.Context,
	fn func(txRepo *ResponseAnswerVectorRepository) error,
) error {
	return r.base.WithTx(ctx, func(txBase *BaseRepository) error {
		txRepo := &ResponseAnswerVectorRepository{base: txBase}
		return fn(txRepo)
	})
}

// Create inserts a single vector
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

	return r.base.Exec(ctx, query, vector.ID, vector.ResponseAnswerID, vector.Embedding, vector.ModelName)
}

// CreateBulk inserts multiple vectors at once
func (r *ResponseAnswerVectorRepository) CreateBulk(ctx context.Context, vectors []*entities.ResponseAnswerVector) error {
	if len(vectors) == 0 {
		return nil
	}

	for _, v := range vectors {
		if v.ID == uuid.Nil {
			v.ID = uuid.New()
		}
	}

	const query = `
		INSERT INTO response_answer_vectors (
			id, response_answer_id, embedding, model_name, created_at
		) VALUES ($1, $2, $3, $4, NOW())
	`

	for _, v := range vectors {
		if err := r.base.Exec(ctx, query, v.ID, v.ResponseAnswerID, v.Embedding, v.ModelName); err != nil {
			return fmt.Errorf("CreateBulk: %w", err)
		}
	}

	return nil
}

// GetByID retrieves a single vector by ID
func (r *ResponseAnswerVectorRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.ResponseAnswerVector, error) {
	const query = `
		SELECT id, response_answer_id, embedding, model_name, created_at
		FROM response_answer_vectors
		WHERE id=$1
	`

	row := r.base.QueryRow(ctx, query, id)
	var v entities.ResponseAnswerVector
	if err := row.Scan(&v.ID, &v.ResponseAnswerID, &v.Embedding, &v.ModelName, &v.CreatedAt); err != nil {
		return nil, fmt.Errorf("GetByID: %w", err)
	}

	return &v, nil
}

// List retrieves vectors based on filter
func (r *ResponseAnswerVectorRepository) List(ctx context.Context, filter interfaces.ResponseAnswerVectorFilter) ([]*entities.ResponseAnswerVector, error) {
	query := `
		SELECT id, response_answer_id, embedding, model_name, created_at
		FROM response_answer_vectors
		WHERE 1=1
	`
	var args []interface{}
	argPos := 1

	if filter.ResponseAnswerID != nil {
		query += fmt.Sprintf(" AND response_answer_id=$%d", argPos)
		args = append(args, *filter.ResponseAnswerID)
		argPos++
	}

	if filter.ModelName != nil {
		query += fmt.Sprintf(" AND model_name=$%d", argPos)
		args = append(args, *filter.ModelName)
		argPos++
	}

	rows, err := r.base.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("List: %w", err)
	}
	defer rows.Close()

	var vectors []*entities.ResponseAnswerVector
	for rows.Next() {
		var v entities.ResponseAnswerVector
		if err := rows.Scan(&v.ID, &v.ResponseAnswerID, &v.Embedding, &v.ModelName, &v.CreatedAt); err != nil {
			return nil, fmt.Errorf("List.Scan: %w", err)
		}
		vectors = append(vectors, &v)
	}

	return vectors, nil
}

// Delete removes a vector by ID
func (r *ResponseAnswerVectorRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM response_answer_vectors WHERE id=$1`
	return r.base.Exec(ctx, query, id)
}

// Base returns the underlying BaseRepository for transactional use
func (r *ResponseAnswerVectorRepository) Base() *BaseRepository {
	return r.base
}

// WithTxRepo creates a repository instance bound to the given transaction
func (r *ResponseAnswerVectorRepository) WithTxRepo(txRepo interfaces.ResponseRepository) interfaces.ResponseAnswerVectorRepository {
	// We need to cast txRepo to *ResponseRepository to access its BaseRepository
	if impl, ok := txRepo.(*ResponseRepository); ok {
		return &ResponseAnswerVectorRepository{base: impl.base}
	}
	return r
}
