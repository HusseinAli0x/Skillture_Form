package quiz

import (
	"context"
	"errors"

	"Skillture_Form/internal/domain/entities"
	domainErrors "Skillture_Form/internal/domain/errors"
	repo "Skillture_Form/internal/repository/interfaces"
	uc "Skillture_Form/internal/usecase/interfaces"

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
	if !session.IsLobby() {
		return nil, domainErrors.ErrSessionNotInLobby
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
