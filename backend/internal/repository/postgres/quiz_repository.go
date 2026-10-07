package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// quizRepository implements interfaces.QuizRepository using PostgreSQL.
//
// Responsibilities:
// - CRUD for the quizzes table
// - Optional status filter for list queries
// - Compile-time interface assertion
type quizRepository struct {
	*BaseRepository
}

// Compile-time assertion: quizRepository must satisfy QuizRepository
var _ interfaces.QuizRepository = (*quizRepository)(nil)

// NewQuizRepository constructs a quizRepository backed by the given BaseRepository.
func NewQuizRepository(base *BaseRepository) interfaces.QuizRepository {
	return &quizRepository{BaseRepository: base}
}

const quizColumns = `id, title, description, status, created_at, owner_key_hash`

// scanQuiz scans a single pgx.Row into an entities.Quiz value.
func scanQuiz(row pgx.Row) (*entities.Quiz, error) {
	var q entities.Quiz
	var titleBytes, descBytes []byte
	err := row.Scan(
		&q.ID,
		&titleBytes,
		&descBytes,
		&q.Status,
		&q.CreatedAt,
		&q.OwnerKeyHash,
	)
	if err != nil {
		return nil, err
	}
	q.ByVisitor = q.OwnerKeyHash != nil
	if len(titleBytes) > 0 {
		_ = json.Unmarshal(titleBytes, &q.Title)
	}
	if len(descBytes) > 0 {
		_ = json.Unmarshal(descBytes, &q.Description)
	}
	return &q, nil
}

// Create inserts a new quiz record into the database.
func (r *quizRepository) Create(ctx context.Context, quiz *entities.Quiz) error {
	if quiz.ID == uuid.Nil {
		quiz.ID = uuid.New()
	}

	const query = `
		INSERT INTO quizzes (id, title, description, status, created_at, owner_key_hash)
		VALUES ($1, $2, $3, $4, NOW(), $5)
	`
	titleBytes, _ := json.Marshal(quiz.Title)
	descBytes, _ := json.Marshal(quiz.Description)

	return r.Exec(ctx, query, quiz.ID, titleBytes, descBytes, quiz.Status, quiz.OwnerKeyHash)
}

// GetByID retrieves a quiz by its primary key.
// Returns nil, nil when no row is found.
func (r *quizRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.Quiz, error) {
	const query = `SELECT ` + quizColumns + ` FROM quizzes WHERE id = $1`

	q, err := scanQuiz(r.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("quizRepository.GetByID: %w", err)
	}
	return q, nil
}

// Update modifies the title, description, and status of an existing quiz.
func (r *quizRepository) Update(ctx context.Context, quiz *entities.Quiz) error {
	const query = `
		UPDATE quizzes
		SET title       = $2,
		    description = $3,
		    status      = $4
		WHERE id = $1
	`
	titleBytes, _ := json.Marshal(quiz.Title)
	descBytes, _ := json.Marshal(quiz.Description)
	tag, err := r.exec.Exec(ctx, query, quiz.ID, titleBytes, descBytes, quiz.Status)
	if err != nil {
		return fmt.Errorf("quizRepository.Update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// Delete removes a quiz by ID. Cascade rules handle child records.
func (r *quizRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM quizzes WHERE id = $1`

	tag, err := r.exec.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("quizRepository.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// List retrieves quizzes ordered by created_at DESC, with an optional status filter.
func (r *quizRepository) List(ctx context.Context, filter interfaces.QuizFilter) ([]*entities.Quiz, error) {
	baseQuery := `SELECT ` + quizColumns + ` FROM quizzes WHERE 1=1`
	var args []interface{}
	argPos := 1

	if filter.Status != nil {
		baseQuery += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, *filter.Status)
		argPos++
	}
	if filter.OwnerKeyHash != nil {
		baseQuery += fmt.Sprintf(" AND owner_key_hash = $%d", argPos)
		args = append(args, *filter.OwnerKeyHash)
	}

	baseQuery += " ORDER BY created_at DESC"

	rows, err := r.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("quizRepository.List: %w", err)
	}
	defer rows.Close()

	var quizzes []*entities.Quiz
	for rows.Next() {
		var q entities.Quiz
		if err := rows.Scan(&q.ID, &q.Title, &q.Description, &q.Status, &q.CreatedAt, &q.OwnerKeyHash); err != nil {
			return nil, fmt.Errorf("quizRepository.List.Scan: %w", err)
		}
		q.ByVisitor = q.OwnerKeyHash != nil
		quizzes = append(quizzes, &q)
	}

	// A failure part-way through iteration otherwise returns a truncated
	// slice as if it were a complete, successful result.
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return quizzes, nil
}

// CountByOwner returns how many quizzes a visitor has created.
func (r *quizRepository) CountByOwner(ctx context.Context, ownerKeyHash string) (int, error) {
	var n int
	row := r.QueryRow(ctx, `SELECT COUNT(*) FROM quizzes WHERE owner_key_hash = $1`, ownerKeyHash)
	if err := row.Scan(&n); err != nil {
		return 0, fmt.Errorf("quizRepository.CountByOwner: %w", err)
	}
	return n, nil
}

// DeleteStaleVisitorQuizzes removes visitor-created quizzes that were created
// before cutoff and have neither been hosted nor had a question edited since.
// Child rows cascade.
func (r *quizRepository) DeleteStaleVisitorQuizzes(ctx context.Context, cutoff time.Time) (int64, error) {
	const query = `
		DELETE FROM quizzes q
		WHERE q.owner_key_hash IS NOT NULL
		  AND q.created_at < $1
		  AND NOT EXISTS (
		    SELECT 1 FROM quiz_sessions s
		    WHERE s.quiz_id = q.id AND s.created_at >= $1
		  )
		  AND NOT EXISTS (
		    SELECT 1 FROM quiz_questions qq
		    WHERE qq.quiz_id = q.id AND qq.updated_at >= $1
		  )
	`
	tag, err := r.exec.Exec(ctx, query, cutoff)
	if err != nil {
		return 0, fmt.Errorf("quizRepository.DeleteStaleVisitorQuizzes: %w", err)
	}
	return tag.RowsAffected(), nil
}
