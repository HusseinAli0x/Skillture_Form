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

// JoinSession adds a new player to a lobby session.
// Business rules enforced:
//   - Session must exist
//   - Session must be in lobby state (game not yet started)
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
		return nil, errors.New("session not found")
	}
	if session.IsFinished() {
		return nil, errors.New("session is already finished")
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
