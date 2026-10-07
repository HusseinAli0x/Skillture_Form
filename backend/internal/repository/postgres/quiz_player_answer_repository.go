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

// quizPlayerAnswerRepository implements interfaces.QuizPlayerAnswerRepository using PostgreSQL.
//
// Responsibilities:
// - Record player answers during a live session
// - Guard against double-answers via ExistsByPlayerAndQuestion
// - List answers by player, session, or question for scoring/analytics
// - Compile-time interface assertion
type quizPlayerAnswerRepository struct {
	*BaseRepository
}

// Compile-time assertion
var _ interfaces.QuizPlayerAnswerRepository = (*quizPlayerAnswerRepository)(nil)

// NewQuizPlayerAnswerRepository constructs a quizPlayerAnswerRepository backed by the given BaseRepository.
func NewQuizPlayerAnswerRepository(base *BaseRepository) interfaces.QuizPlayerAnswerRepository {
	return &quizPlayerAnswerRepository{BaseRepository: base}
}

// scanQuizPlayerAnswer scans a single pgx.Row into an entities.QuizPlayerAnswer value.
func scanQuizPlayerAnswer(row pgx.Row) (*entities.QuizPlayerAnswer, error) {
	var a entities.QuizPlayerAnswer
	err := row.Scan(
		&a.ID,
		&a.PlayerID,
		&a.SessionID,
		&a.QuestionID,
		&a.Answer,
		&a.IsCorrect,
		&a.ScoreAwarded,
		&a.TimeTakenMs,
		&a.AnsweredAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// Create records a player's answer. The UNIQUE constraint on (player_id, question_id)
// enforces the no-double-answer rule at the DB level as a safety net;
// ExistsByPlayerAndQuestion should be called first at the use-case level.
func (r *quizPlayerAnswerRepository) Create(ctx context.Context, answer *entities.QuizPlayerAnswer) error {
	if answer.ID == uuid.Nil {
		answer.ID = uuid.New()
	}

	const query = `
		INSERT INTO quiz_player_answers (
			id, player_id, session_id, question_id,
			answer, is_correct, score_awarded, time_taken_ms,
			answered_at
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8,
			NOW()
		)
	`

	return r.Exec(ctx, query,
		answer.ID,
		answer.PlayerID,
		answer.SessionID,
		answer.QuestionID,
		answer.Answer,
		answer.IsCorrect,
		answer.ScoreAwarded,
		answer.TimeTakenMs,
	)
}

// GetByID retrieves a single answer record by primary key.
// Returns nil, nil when no row is found.
func (r *quizPlayerAnswerRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.QuizPlayerAnswer, error) {
	const query = `
		SELECT id, player_id, session_id, question_id,
		       answer, is_correct, score_awarded, time_taken_ms, answered_at
		FROM quiz_player_answers
		WHERE id = $1
	`

	a, err := scanQuizPlayerAnswer(r.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("quizPlayerAnswerRepository.GetByID: %w", err)
	}
	return a, nil
}

// ExistsByPlayerAndQuestion returns true if the player has already submitted an answer
// for the given question. Called by the use case before inserting to surface a
// domain-friendly error rather than a raw DB constraint violation.
func (r *quizPlayerAnswerRepository) ExistsByPlayerAndQuestion(
	ctx context.Context,
	playerID, questionID uuid.UUID,
) (bool, error) {
	const query = `
		SELECT EXISTS (
			SELECT 1 FROM quiz_player_answers
			WHERE player_id = $1 AND question_id = $2
		)
	`

	var exists bool
	if err := r.QueryRow(ctx, query, playerID, questionID).Scan(&exists); err != nil {
		return false, fmt.Errorf("quizPlayerAnswerRepository.ExistsByPlayerAndQuestion: %w", err)
	}
	return exists, nil
}

// List retrieves answers matching the optional composite filter.
func (r *quizPlayerAnswerRepository) List(
	ctx context.Context,
	filter interfaces.QuizPlayerAnswerFilter,
) ([]*entities.QuizPlayerAnswer, error) {
	baseQuery := `
		SELECT id, player_id, session_id, question_id,
		       answer, is_correct, score_awarded, time_taken_ms, answered_at
		FROM quiz_player_answers
		WHERE 1=1
	`
	var args []interface{}
	argPos := 1

	if filter.PlayerID != nil {
		baseQuery += fmt.Sprintf(" AND player_id = $%d", argPos)
		args = append(args, *filter.PlayerID)
		argPos++
	}

	if filter.SessionID != nil {
		baseQuery += fmt.Sprintf(" AND session_id = $%d", argPos)
		args = append(args, *filter.SessionID)
		argPos++
	}

	if filter.QuestionID != nil {
		baseQuery += fmt.Sprintf(" AND question_id = $%d", argPos)
		args = append(args, *filter.QuestionID)
		argPos++
	}
	_ = argPos

	baseQuery += " ORDER BY answered_at ASC"

	rows, err := r.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("quizPlayerAnswerRepository.List: %w", err)
	}
	defer rows.Close()

	var answers []*entities.QuizPlayerAnswer
	for rows.Next() {
		var a entities.QuizPlayerAnswer
		if err := rows.Scan(
			&a.ID, &a.PlayerID, &a.SessionID, &a.QuestionID,
			&a.Answer, &a.IsCorrect, &a.ScoreAwarded, &a.TimeTakenMs, &a.AnsweredAt,
		); err != nil {
			return nil, fmt.Errorf("quizPlayerAnswerRepository.List.Scan: %w", err)
		}
		answers = append(answers, &a)
	}

	// A failure part-way through iteration otherwise returns a truncated
	// slice as if it were a complete, successful result.
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return answers, nil
}

// Delete removes an answer record by ID.
func (r *quizPlayerAnswerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM quiz_player_answers WHERE id = $1`

	tag, err := r.exec.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("quizPlayerAnswerRepository.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
