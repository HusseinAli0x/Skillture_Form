package interfaces

import (
	"context"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"

	"github.com/google/uuid"
)

// QuizSessionFilter holds optional filter criteria for listing sessions
type QuizSessionFilter struct {
	QuizID *uuid.UUID               // optional: restrict to sessions of a specific quiz
	Status *enums.QuizSessionStatus // optional: filter by lobby/active/finished
}

// QuizSessionRepository defines persistence operations for live quiz sessions
type QuizSessionRepository interface {
	// Create inserts a new session record. Sets a generated UUID if ID is nil.
	Create(ctx context.Context, session *entities.QuizSession) error
	// GetByID retrieves a session by its primary key. Returns nil, nil when not found.
	GetByID(ctx context.Context, id uuid.UUID) (*entities.QuizSession, error)
	// GetByPIN retrieves a session by its join PIN. Returns nil, nil when not found.
	GetByPIN(ctx context.Context, pin string) (*entities.QuizSession, error)
	// Update persists status changes and current_question_id / timestamp updates.
	Update(ctx context.Context, session *entities.QuizSession) error
	// Delete removes a session and cascades to players and answers.
	Delete(ctx context.Context, id uuid.UUID) error
	// List retrieves sessions matching the optional filter.
	List(ctx context.Context, filter QuizSessionFilter) ([]*entities.QuizSession, error)
}
