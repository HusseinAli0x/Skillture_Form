package quiz

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

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
func (u *quizPlayerUseCase) JoinSession(ctx context.Context, sessionID uuid.UUID, name string, avatarID *int16, avatarURL *string) (*entities.QuizPlayer, error) {
	// Anyone with a PIN can call this, so everything a player supplies is
	// bounded here: it is stored, and broadcast to every screen in the room.
	name, err := cleanPlayerName(name)
	if err != nil {
		return nil, err
	}
	avatarURL, err = cleanAvatarURL(avatarURL)
	if err != nil {
		return nil, err
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
	joined, err := u.playerRepo.CountBySessionID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if joined >= MaxPlayersPerSession {
		return nil, domainErrors.ErrSessionFull
	}

	// The secret is returned to the player once; only its hash is stored.
	secret, secretHash, err := entities.NewPlayerSecret()
	if err != nil {
		return nil, fmt.Errorf("JoinSession: %w", err)
	}

	player := &entities.QuizPlayer{
		ID:         uuid.New(),
		SessionID:  sessionID,
		Name:       name,
		Score:      0,
		AvatarID:   avatarID,
		AvatarURL:  avatarURL,
		SecretHash: &secretHash,
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

	player.Secret = secret
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

// Limits on what a joining player may send.
const (
	// MaxPlayerNameLen is in characters, not bytes: Arabic names are 2 bytes each.
	MaxPlayerNameLen = 24
	// MaxAvatarDataURLLen bounds an uploaded avatar. The client shrinks photos
	// to a 160px JPEG of a few kilobytes; this leaves generous headroom.
	MaxAvatarDataURLLen = 100_000
	// MaxPlayersPerSession bounds a single game's roster.
	MaxPlayersPerSession = 200
)

// An avatar is an inline raster image. Anything else — notably an http(s) URL,
// which every viewer's browser would then fetch from a host the player picked —
// is refused.
var avatarDataURL = regexp.MustCompile(`^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$`)

func cleanPlayerName(raw string) (string, error) {
	name := strings.Join(strings.Fields(raw), " ")
	if name == "" {
		return "", fmt.Errorf("%w: player name is required", domainErrors.ErrInvalidInput)
	}
	if utf8.RuneCountInString(name) > MaxPlayerNameLen {
		return "", fmt.Errorf("%w: player name must be at most %d characters", domainErrors.ErrInvalidInput, MaxPlayerNameLen)
	}
	for _, r := range name {
		if unicode.IsControl(r) {
			return "", fmt.Errorf("%w: player name contains invalid characters", domainErrors.ErrInvalidInput)
		}
	}
	return name, nil
}

func cleanAvatarURL(raw *string) (*string, error) {
	if raw == nil || *raw == "" {
		return nil, nil
	}
	if len(*raw) > MaxAvatarDataURLLen || !avatarDataURL.MatchString(*raw) {
		return nil, fmt.Errorf("%w: avatar must be a small inline image", domainErrors.ErrInvalidInput)
	}
	return raw, nil
}
