package interfaces

import (
	"context"

	"Skillture_Form/internal/domain/entities"

	"github.com/google/uuid"
)

// QuizPlayerRepository defines persistence operations for players in a live session
type QuizPlayerRepository interface {
	// Create inserts a new player record. Sets a generated UUID if ID is nil.
	Create(ctx context.Context, player *entities.QuizPlayer) error
	// GetByID retrieves a player by primary key. Returns nil, nil when not found.
	GetByID(ctx context.Context, id uuid.UUID) (*entities.QuizPlayer, error)
	// UpdateScore persists the player's cumulative score.
	UpdateScore(ctx context.Context, playerID uuid.UUID, score int) error
	// Delete removes a player record.
	Delete(ctx context.Context, id uuid.UUID) error
	// ListBySessionID returns all players in a session, ordered by score descending.
	// This is the leaderboard query used after each question.
	ListBySessionID(ctx context.Context, sessionID uuid.UUID) ([]*entities.QuizPlayer, error)
}
