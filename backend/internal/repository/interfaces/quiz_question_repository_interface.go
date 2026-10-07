package interfaces

import (
	"context"

	"skillture/backend/internal/domain/entities"

	"github.com/google/uuid"
)

// QuizQuestionFilter holds optional filter criteria for listing quiz questions
type QuizQuestionFilter struct {
	QuizID *uuid.UUID // optional: restrict to questions of a specific quiz
}

// QuizQuestionRepository defines persistence operations for quiz questions
type QuizQuestionRepository interface {
	// Create inserts a new question. Sets a generated UUID if ID is nil.
	Create(ctx context.Context, question *entities.QuizQuestion) error
	// GetByID retrieves a question by its primary key. Returns nil, nil when not found.
	GetByID(ctx context.Context, id uuid.UUID) (*entities.QuizQuestion, error)
	// Update modifies an existing question's mutable fields.
	Update(ctx context.Context, question *entities.QuizQuestion) error
	// Delete removes a question by ID.
	Delete(ctx context.Context, id uuid.UUID) error
	// List retrieves questions ordered by position, with an optional quiz filter.
	List(ctx context.Context, filter QuizQuestionFilter) ([]*entities.QuizQuestion, error)

	// ReplaceByQuizID makes the quiz's questions match the given slice exactly,
	// in a single transaction: questions carrying an existing ID are updated,
	// questions without one are inserted, and any question of this quiz not in
	// the slice is deleted.
	//
	// The builder previously did this as a sequential run of per-question
	// requests, so a failure part-way through left the quiz half-written.
	//
	// Note this is an upsert, not delete-and-recreate: quiz_player_answers
	// references quiz_questions(id), so recreating rows would discard the
	// answers of any game already played on this quiz.
	ReplaceByQuizID(ctx context.Context, quizID uuid.UUID, questions []*entities.QuizQuestion) error
}
