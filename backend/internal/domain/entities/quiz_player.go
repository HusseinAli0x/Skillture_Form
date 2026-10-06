package entities

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Domain errors for the QuizPlayer entity
var (
	ErrMissingPlayerName      = errors.New("player name is missing")
	ErrMissingPlayerSessionID = errors.New("player session ID is missing")
)

// QuizPlayer represents a participant in a live quiz session.
// Players do not need accounts; they are identified by nickname within a session.
type QuizPlayer struct {
	ID        uuid.UUID `db:"id"         json:"id"`
	SessionID uuid.UUID `db:"session_id" json:"session_id"`
	Name      string    `db:"name"       json:"name"`  // Unique nickname within the session
	Score     int       `db:"score"      json:"score"` // Cumulative score
	JoinedAt  time.Time `db:"joined_at"  json:"joined_at"`
	// AvatarID indexes into the frontend's fixed glyph-avatar list (0-6, see
	// frontend/src/lib/avatars.ts). Nil when the player uploaded a photo
	// instead, or hasn't picked yet.
	AvatarID *int16 `db:"avatar_id" json:"avatar_id,omitempty"`
	// AvatarURL is a data: URL for an uploaded photo. Nil when the player
	// picked a glyph instead, or hasn't picked yet. Mutually exclusive with
	// AvatarID in practice, but nothing enforces that beyond the join usecase.
	AvatarURL *string `db:"avatar_url" json:"avatar_url,omitempty"`
}

// TableName returns the PostgreSQL table name
func (QuizPlayer) TableName() string {
	return "quiz_players"
}

// AddScore increments the player's total score
func (p *QuizPlayer) AddScore(points int) {
	if points > 0 {
		p.Score += points
	}
}

// IsValid validates domain-level rules for a QuizPlayer
func (p *QuizPlayer) IsValid() error {
	if p.SessionID == uuid.Nil {
		return ErrMissingPlayerSessionID
	}
	if p.Name == "" {
		return ErrMissingPlayerName
	}
	return nil
}
