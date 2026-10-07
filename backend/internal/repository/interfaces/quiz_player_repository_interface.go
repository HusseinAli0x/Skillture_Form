package interfaces

import (
	"context"

	"skillture/backend/internal/domain/entities"

	"github.com/google/uuid"
)

// QuizPlayerRepository defines persistence operations for players in a live session
type QuizPlayerRepository interface {
	// Create inserts a new player record. Sets a generated UUID if ID is nil.
	Create(ctx context.Context, player *entities.QuizPlayer) error
	// GetByID retrieves a player by primary key. Returns nil, nil when not found.
	GetByID(ctx context.Context, id uuid.UUID) (*entities.QuizPlayer, error)
	// AddScore atomically increments the player's cumulative score by points
	// and returns the new total. Incrementing in SQL rather than writing a
	// value computed in Go keeps concurrent answers from overwriting each
	// other.
	AddScore(ctx context.Context, playerID uuid.UUID, points int) (int, error)
	// Delete removes a player record.
	Delete(ctx context.Context, id uuid.UUID) error
	// ListBySessionID returns all players in a session, ordered by score descending.
	// This is the leaderboard query used after each question.
	ListBySessionID(ctx context.Context, sessionID uuid.UUID) ([]*entities.QuizPlayer, error)
	// CountBySessionID returns how many players have joined a session, without
	// loading them (their avatars are large).
	CountBySessionID(ctx context.Context, sessionID uuid.UUID) (int, error)
}
