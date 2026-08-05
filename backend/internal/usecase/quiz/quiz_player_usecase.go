package quiz

import (
	"context"
	"errors"

	"skillture/backend/internal/domain/entities"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"
	uc "skillture/backend/internal/usecase/interfaces"

	"github.com/google/uuid"
)

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
		// The unique index on (session_id, name) will cause a conflict error;
		// surface it as a domain error so handlers can return 409.
		return nil, domainErrors.ErrDuplicatePlayerName
	}

	return player, nil
}

// GetLeaderboard returns all players in a session sorted by score DESC.
func (u *quizPlayerUseCase) GetLeaderboard(ctx context.Context, sessionID uuid.UUID) ([]*entities.QuizPlayer, error) {
	return u.playerRepo.ListBySessionID(ctx, sessionID)
}
