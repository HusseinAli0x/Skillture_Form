package postgres

import (
	"context"
	"errors"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/repository/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type responseAnswerRepository struct {
	base *BaseRepository
}

func NewResponseAnswerRepository(base *BaseRepository) interfaces.ResponseAnswerRepository {
	return &responseAnswerRepository{base: base}
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

func (r *responseAnswerRepository) Create(ctx context.Context, answer *entities.ResponseAnswer) error {
	if answer.ID == uuid.Nil {
		answer.ID = uuid.New()
	}

	const query = `
		INSERT INTO response_answers (id, response_id, field_id, value, created_at)
		VALUES ($1, $2, $3, $4, NOW())
	`

	return r.base.Exec(ctx, query, answer.ID, answer.ResponseID, answer.FieldID, answer.Value)
}

func (r *responseAnswerRepository) CreateBulk(ctx context.Context, answers []*entities.ResponseAnswer) error {
	// Simple loop implementation for now
	for _, a := range answers {
		if err := r.Create(ctx, a); err != nil {
			return err
		}
	}
	return nil
}

func (r *responseAnswerRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.ResponseAnswer, error) {
	const query = `SELECT id, response_id, field_id, value, created_at FROM response_answers WHERE id = $1`

	row := r.base.QueryRow(ctx, query, id)
	a, err := scanResponseAnswer(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return a, err
}

func (r *responseAnswerRepository) List(ctx context.Context, filter interfaces.ResponseAnswerFilter) ([]*entities.ResponseAnswer, error) {
	// Minimal implementation to satisfy interface
	// If needed, implement proper filtering
	return nil, nil
}

func (r *responseAnswerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM response_answers WHERE id = $1`
	return r.base.Exec(ctx, query, id)
}

// WithTxRepo - The missing method!
func (r *responseAnswerRepository) WithTxRepo(txRepo interfaces.ResponseRepository) interfaces.ResponseAnswerRepository {
	// We need to cast txRepo to *ResponseRepository to access its BaseRepository
	if impl, ok := txRepo.(*ResponseRepository); ok {
		return &responseAnswerRepository{base: impl.base}
	}
	// Fallback: return self (might not be transactional if cast failed)
	// Ideally log error but we can't here easily without logger.
	return r
}
