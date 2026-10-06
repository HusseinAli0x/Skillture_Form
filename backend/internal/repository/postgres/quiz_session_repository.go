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

// quizSessionRepository implements interfaces.QuizSessionRepository using PostgreSQL.
//
// Responsibilities:
// - CRUD for the quiz_sessions table
// - GetByPIN for the player join flow
// - Update persists status transitions and current_question_id
// - Compile-time interface assertion
type quizSessionRepository struct {
	*BaseRepository
}

// Compile-time assertion
var _ interfaces.QuizSessionRepository = (*quizSessionRepository)(nil)

// NewQuizSessionRepository constructs a quizSessionRepository backed by the given BaseRepository.
func NewQuizSessionRepository(base *BaseRepository) interfaces.QuizSessionRepository {
	return &quizSessionRepository{BaseRepository: base}
}

const quizSessionColumns = `
	id, quiz_id, host_id, pin, status,
	current_question_id, created_at, started_at, finished_at
`

// scanQuizSession scans a single pgx.Row into an entities.QuizSession value.
// current_question_id, started_at and finished_at are nullable.
func scanQuizSession(row pgx.Row) (*entities.QuizSession, error) {
	var s entities.QuizSession
	err := row.Scan(
		&s.ID,
		&s.QuizID,
		&s.HostID,
		&s.PIN,
		&s.Status,
		&s.CurrentQuestionID, // *uuid.UUID — pgx handles NULL → nil
		&s.CreatedAt,
		&s.StartedAt,  // *time.Time
		&s.FinishedAt, // *time.Time
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// Create inserts a new session record into the database.
func (r *quizSessionRepository) Create(ctx context.Context, session *entities.QuizSession) error {
	if session.ID == uuid.Nil {
		session.ID = uuid.New()
	}

	const query = `
		INSERT INTO quiz_sessions (
			id, quiz_id, host_id, pin, status,
			current_question_id, created_at, started_at, finished_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, NOW(), $7, $8
		)
	`

	return r.Exec(ctx, query,
		session.ID,
		session.QuizID,
		session.HostID,
		session.PIN,
		session.Status,
		session.CurrentQuestionID,
		session.StartedAt,
		session.FinishedAt,
	)
}

// GetByID retrieves a session by its primary key.
// Returns nil, nil when no row is found.
func (r *quizSessionRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.QuizSession, error) {
	query := `SELECT ` + quizSessionColumns + ` FROM quiz_sessions WHERE id = $1`

	s, err := scanQuizSession(r.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("quizSessionRepository.GetByID: %w", err)
	}
	return s, nil
}

// GetByPIN retrieves a session by its join PIN.
// Returns nil, nil when no row is found.
func (r *quizSessionRepository) GetByPIN(ctx context.Context, pin string) (*entities.QuizSession, error) {
	query := `SELECT ` + quizSessionColumns + ` FROM quiz_sessions WHERE pin = $1`

	s, err := scanQuizSession(r.QueryRow(ctx, query, pin))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("quizSessionRepository.GetByPIN: %w", err)
	}
	return s, nil
}

// Update persists status transitions, current_question_id, and lifecycle timestamps.
func (r *quizSessionRepository) Update(ctx context.Context, session *entities.QuizSession) error {
	const query = `
		UPDATE quiz_sessions
		SET status              = $2,
		    current_question_id = $3,
		    started_at          = $4,
		    finished_at         = $5
		WHERE id = $1
	`

	tag, err := r.exec.Exec(ctx, query,
		session.ID,
		session.Status,
		session.CurrentQuestionID,
		session.StartedAt,
		session.FinishedAt,
	)
	if err != nil {
		return fmt.Errorf("quizSessionRepository.Update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// Delete removes a session by ID. Cascade rules handle players and answers.
func (r *quizSessionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM quiz_sessions WHERE id = $1`

	tag, err := r.exec.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("quizSessionRepository.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// List retrieves sessions matching the optional filter, ordered by created_at DESC.
func (r *quizSessionRepository) List(ctx context.Context, filter interfaces.QuizSessionFilter) ([]*entities.QuizSession, error) {
	baseQuery := `SELECT ` + quizSessionColumns + ` FROM quiz_sessions WHERE 1=1`
	var args []interface{}
	argPos := 1

	if filter.QuizID != nil {
		baseQuery += fmt.Sprintf(" AND quiz_id = $%d", argPos)
		args = append(args, *filter.QuizID)
		argPos++
	}

	if filter.Status != nil {
		baseQuery += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, *filter.Status)
		argPos++
	}
	_ = argPos

	baseQuery += " ORDER BY created_at DESC"

	rows, err := r.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("quizSessionRepository.List: %w", err)
	}
	defer rows.Close()

	var sessions []*entities.QuizSession
	for rows.Next() {
		var s entities.QuizSession
		if err := rows.Scan(
			&s.ID, &s.QuizID, &s.HostID, &s.PIN, &s.Status,
			&s.CurrentQuestionID, &s.CreatedAt, &s.StartedAt, &s.FinishedAt,
		); err != nil {
			return nil, fmt.Errorf("quizSessionRepository.List.Scan: %w", err)
		}
		sessions = append(sessions, &s)
	}

	// A failure part-way through iteration otherwise returns a truncated
	// slice as if it were a complete, successful result.
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return sessions, nil
}
