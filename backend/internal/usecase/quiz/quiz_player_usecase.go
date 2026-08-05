package quiz

import (
	"context"
	"errors"

	"skillture/backend/internal/domain/entities"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"
	uc "skillture/backend/internal/usecase/interfaces"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

// pgUniqueViolation is PostgreSQL's SQLSTATE for a unique constraint violation.
const pgUniqueViolation = "23505"

// quizPlayerUseCase is the concrete implementation of QuizPlayerUseCase.
type quizPlayerUseCase struct {
	sessionRepo repo.QuizSessionRepository
	playerRepo  repo.QuizPlayerRepository
}

// Compile-time assertion
var _ uc.QuizPlayerUseCase = (*quizPlayerUseCase)(nil)

// NewQuizPlayerUseCase creates a new QuizPlayerUseCase.
func NewQuizPlayerUseCase(
	sessionRepo repo.QuizSessionRepository,
	playerRepo repo.QuizPlayerRepository,
) uc.QuizPlayerUseCase {
	return &quizPlayerUseCase{
		sessionRepo: sessionRepo,
		playerRepo:  playerRepo,
	}
}

// JoinSession adds a new player to a session.
//
// Late joining is deliberate: a player may join a session that has already
// started, and lands on whatever question is current with a score of 0. This
// is what makes reconnecting work — a player whose phone died mid-game rejoins
// through exactly this path.
//
// This was previously documented and typed as rejecting anything but a lobby
// session, which it never actually did — the behaviour was right and the
// contract around it was wrong. The contract now matches, and the unused
// domain error it named is gone.
//
// Business rules enforced:
//   - Session must exist
//   - Session must not be finished
//   - Nickname must be unique within the session
func (u *quizPlayerUseCase) JoinSession(ctx context.Context, sessionID uuid.UUID, name string) (*entities.QuizPlayer, error) {
	if name == "" {
		return nil, errors.New("player name is required")
	}

	session, err := u.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, domainErrors.ErrNotFound
	}
	// A finished game is the one state that cannot be joined: there is nothing
	// left to answer and the leaderboard is finalised.
	if session.IsFinished() {
		return nil, domainErrors.ErrSessionFinished
	}

	player := &entities.QuizPlayer{
		ID:        uuid.New(),
		SessionID: sessionID,
		Name:      name,
		Score:     0,
	}

	if err := u.playerRepo.Create(ctx, player); err != nil {
		// Only a unique-violation on (session_id, name) means the nickname is
		// taken. Reporting every failure as a duplicate name turned database
		// outages into a misleading "that nickname is taken" 409.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return nil, domainErrors.ErrDuplicatePlayerName
		}
		return nil, err
	}

	return player, nil
}

// GetPlayer retrieves a single player by ID.
func (u *quizPlayerUseCase) GetPlayer(ctx context.Context, playerID uuid.UUID) (*entities.QuizPlayer, error) {
	return u.playerRepo.GetByID(ctx, playerID)
}

// GetLeaderboard returns all players in a session sorted by score DESC.
func (u *quizPlayerUseCase) GetLeaderboard(ctx context.Context, sessionID uuid.UUID) ([]*entities.QuizPlayer, error) {
	return u.playerRepo.ListBySessionID(ctx, sessionID)
}
