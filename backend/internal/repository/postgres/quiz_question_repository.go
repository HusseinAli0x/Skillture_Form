package postgres

import (
	"context"
	"encoding/json"
	"fmt"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// quizQuestionRepository implements interfaces.QuizQuestionRepository using PostgreSQL.
//
// Responsibilities:
// - CRUD for the quiz_questions table
// - List with optional quiz-scoped filter, ordered by position
// - Compile-time interface assertion
type quizQuestionRepository struct {
	*BaseRepository
}

// Compile-time assertion
var _ interfaces.QuizQuestionRepository = (*quizQuestionRepository)(nil)

// NewQuizQuestionRepository constructs a quizQuestionRepository backed by the given BaseRepository.
func NewQuizQuestionRepository(base *BaseRepository) interfaces.QuizQuestionRepository {
	return &quizQuestionRepository{BaseRepository: base}
}

// scanQuizQuestion scans a single pgx.Row into an entities.QuizQuestion value.
func scanQuizQuestion(row pgx.Row) (*entities.QuizQuestion, error) {
	var qq entities.QuizQuestion
	var questionBytes, optionsBytes, correctBytes []byte
	err := row.Scan(
		&qq.ID,
		&qq.QuizID,
		&questionBytes,
		&qq.Type,
		&qq.Position,
		&qq.TimeLimitSec,
		&qq.Points,
		&optionsBytes,
		&correctBytes,
		&qq.CreatedAt,
		&qq.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	
	if len(questionBytes) > 0 {
		_ = json.Unmarshal(questionBytes, &qq.Question)
	}
	if len(optionsBytes) > 0 {
		_ = json.Unmarshal(optionsBytes, &qq.Options)
	}
	if len(correctBytes) > 0 {
		_ = json.Unmarshal(correctBytes, &qq.CorrectAnswer)
	}

	return &qq, nil
}

// Create inserts a new quiz question.
func (r *quizQuestionRepository) Create(ctx context.Context, question *entities.QuizQuestion) error {
	if question.ID == uuid.Nil {
		question.ID = uuid.New()
	}

	const query = `
		INSERT INTO quiz_questions (
			id, quiz_id, question, type, position,
			time_limit_sec, points, options, correct_answer,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			NOW(), NOW()
		)
	`

	questionBytes, _ := json.Marshal(question.Question)
	optionsBytes, _ := json.Marshal(question.Options)
	correctBytes, _ := json.Marshal(question.CorrectAnswer)

	return r.Exec(ctx, query,
		question.ID,
		question.QuizID,
		questionBytes,
		question.Type,
		question.Position,
		question.TimeLimitSec,
		question.Points,
		optionsBytes,
		correctBytes,
	)
}

// GetByID retrieves a quiz question by its primary key.
// Returns nil, nil when no row is found.
func (r *quizQuestionRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.QuizQuestion, error) {
	const query = `
		SELECT id, quiz_id, question, type, position,
		       time_limit_sec, points, options, correct_answer,
		       created_at, updated_at
		FROM quiz_questions
		WHERE id = $1
	`

	qq, err := scanQuizQuestion(r.QueryRow(ctx, query, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("quizQuestionRepository.GetByID: %w", err)
	}
	return qq, nil
}

// Update modifies an existing question's mutable fields.
func (r *quizQuestionRepository) Update(ctx context.Context, question *entities.QuizQuestion) error {
	const query = `
		UPDATE quiz_questions
		SET question       = $2,
		    type           = $3,
		    position       = $4,
		    time_limit_sec = $5,
		    points         = $6,
		    options        = $7,
		    correct_answer = $8,
		    updated_at     = NOW()
		WHERE id = $1
	`

	questionBytes, _ := json.Marshal(question.Question)
	optionsBytes, _ := json.Marshal(question.Options)
	correctBytes, _ := json.Marshal(question.CorrectAnswer)

	tag, err := r.exec.Exec(ctx, query,
		question.ID,
		questionBytes,
		question.Type,
		question.Position,
		question.TimeLimitSec,
		question.Points,
		optionsBytes,
		correctBytes,
	)
	if err != nil {
		return fmt.Errorf("quizQuestionRepository.Update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// Delete removes a question by ID.
func (r *quizQuestionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM quiz_questions WHERE id = $1`

	tag, err := r.exec.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("quizQuestionRepository.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// List retrieves questions ordered by position ASC, optionally filtered by quiz_id.
func (r *quizQuestionRepository) List(ctx context.Context, filter interfaces.QuizQuestionFilter) ([]*entities.QuizQuestion, error) {
	baseQuery := `
		SELECT id, quiz_id, question, type, position,
		       time_limit_sec, points, options, correct_answer,
		       created_at, updated_at
		FROM quiz_questions
		WHERE 1=1
	`
	var args []interface{}
	argPos := 1

	if filter.QuizID != nil {
		baseQuery += fmt.Sprintf(" AND quiz_id = $%d", argPos)
		args = append(args, *filter.QuizID)
		argPos++
	}
	_ = argPos

	baseQuery += " ORDER BY position ASC"

	rows, err := r.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("quizQuestionRepository.List: %w", err)
	}
	defer rows.Close()

	var questions []*entities.QuizQuestion
	for rows.Next() {
		var qq entities.QuizQuestion
		var questionBytes, optionsBytes, correctBytes []byte
		if err := rows.Scan(
			&qq.ID, &qq.QuizID, &questionBytes, &qq.Type, &qq.Position,
			&qq.TimeLimitSec, &qq.Points, &optionsBytes, &correctBytes,
			&qq.CreatedAt, &qq.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("quizQuestionRepository.List.Scan: %w", err)
		}

		if len(questionBytes) > 0 {
			_ = json.Unmarshal(questionBytes, &qq.Question)
		}
		if len(optionsBytes) > 0 {
			_ = json.Unmarshal(optionsBytes, &qq.Options)
		}
		if len(correctBytes) > 0 {
			_ = json.Unmarshal(correctBytes, &qq.CorrectAnswer)
		}

		questions = append(questions, &qq)
	}

	return questions, nil
}
