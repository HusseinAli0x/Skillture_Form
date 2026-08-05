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
}
