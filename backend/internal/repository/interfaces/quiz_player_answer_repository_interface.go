package interfaces

import (
	"context"

	"skillture/backend/internal/domain/entities"

	"github.com/google/uuid"
)

// QuizPlayerAnswerFilter holds optional filter criteria for listing answers
type QuizPlayerAnswerFilter struct {
	PlayerID   *uuid.UUID // optional: all answers by a specific player
	SessionID  *uuid.UUID // optional: all answers within a session
	QuestionID *uuid.UUID // optional: all answers for a specific question
}

// QuizPlayerAnswerRepository defines persistence operations for player answers
type QuizPlayerAnswerRepository interface {
	// Create inserts a player's answer. Sets a generated UUID if ID is nil.
	// Returns an error on duplicate (player already answered this question).
	Create(ctx context.Context, answer *entities.QuizPlayerAnswer) error
	// GetByID retrieves a single answer record. Returns nil, nil when not found.
	GetByID(ctx context.Context, id uuid.UUID) (*entities.QuizPlayerAnswer, error)
	// ExistsByPlayerAndQuestion checks if a player has already answered a question.
	// Used to enforce the no-double-answer rule before attempting an insert.
	ExistsByPlayerAndQuestion(ctx context.Context, playerID, questionID uuid.UUID) (bool, error)
	// List retrieves answers matching the optional composite filter.
	List(ctx context.Context, filter QuizPlayerAnswerFilter) ([]*entities.QuizPlayerAnswer, error)
	// Delete removes an answer by ID.
	Delete(ctx context.Context, id uuid.UUID) error
}
