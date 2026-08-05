package postgres

import (
	"context"
	"fmt"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// quizPlayerRepository implements interfaces.QuizPlayerRepository using PostgreSQL.
//
// Responsibilities:
// - Create players in a session (with duplicate name guard)
// - Retrieve players by ID
// - Update cumulative score after each answered question
// - List players ordered by score DESC (leaderboard query)
// - Compile-time interface assertion
type quizPlayerRepository struct {
	*BaseRepository
}

// Compile-time assertion
var _ interfaces.QuizPlayerRepository = (*quizPlayerRepository)(nil)

// NewQuizPlayerRepository constructs a quizPlayerRepository backed by the given BaseRepository.
func NewQuizPlayerRepository(base *BaseRepository) interfaces.QuizPlayerRepository {
	return &quizPlayerRepository{BaseRepository: base}
}

// scanQuizPlayer scans a single pgx.Row into an entities.QuizPlayer value.
func scanQuizPlayer(row pgx.Row) (*entities.QuizPlayer, error) {
	var p entities.QuizPlayer
	err := row.Scan(
		&p.ID,
		&p.SessionID,
		&p.Name,
		&p.Score,
		&p.JoinedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// Create inserts a new player into a session.
// The unique index on (session_id, name) prevents duplicate nicknames.
func (r *quizPlayerRepository) Create(ctx context.Context, player *entities.QuizPlayer) error {
	if player.ID == uuid.Nil {
		player.ID = uuid.New()
	}

	const query = `
		INSERT INTO quiz_players (id, session_id, name, score, joined_at)
		VALUES ($1, $2, $3, $4, NOW())
	`

	return r.Exec(ctx, query,
		player.ID,
		player.SessionID,
		player.Name,
		player.Score,
	)
}

// GetByID retrieves a player by primary key.
// Returns nil, nil when no row is found.
func (r *quizPlayerRepository) GetByID(ctx context.Context, id uuid.UUID) (*entities.QuizPlayer, error) {
	const query = `
		SELECT id, session_id, name, score, joined_at
		FROM quiz_players
		WHERE id = $1
	`

	p, err := scanQuizPlayer(r.QueryRow(ctx, query, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("quizPlayerRepository.GetByID: %w", err)
	}
	return p, nil
}

// UpdateScore atomically sets the player's cumulative score.
// Called by the scoring use case after each answered question.
func (r *quizPlayerRepository) UpdateScore(ctx context.Context, playerID uuid.UUID, score int) error {
	const query = `UPDATE quiz_players SET score = $2 WHERE id = $1`

	tag, err := r.exec.Exec(ctx, query, playerID, score)
	if err != nil {
		return fmt.Errorf("quizPlayerRepository.UpdateScore: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// Delete removes a player record by ID.
func (r *quizPlayerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM quiz_players WHERE id = $1`

	tag, err := r.exec.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("quizPlayerRepository.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// ListBySessionID returns all players in a session ordered by score DESC.
// This is the primary leaderboard query, called after each question is resolved.
func (r *quizPlayerRepository) ListBySessionID(ctx context.Context, sessionID uuid.UUID) ([]*entities.QuizPlayer, error) {
	const query = `
		SELECT id, session_id, name, score, joined_at
		FROM quiz_players
		WHERE session_id = $1
		ORDER BY score DESC, joined_at ASC
	`

	rows, err := r.Query(ctx, query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("quizPlayerRepository.ListBySessionID: %w", err)
	}
	defer rows.Close()

	var players []*entities.QuizPlayer
	for rows.Next() {
		var p entities.QuizPlayer
		if err := rows.Scan(&p.ID, &p.SessionID, &p.Name, &p.Score, &p.JoinedAt); err != nil {
			return nil, fmt.Errorf("quizPlayerRepository.ListBySessionID.Scan: %w", err)
		}
		players = append(players, &p)
	}

	return players, nil
}
