package quiz

import (
	"context"
	"errors"
	"testing"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
)

type fakeSessionRepo struct {
	session *entities.QuizSession
}

func (f *fakeSessionRepo) GetByID(context.Context, uuid.UUID) (*entities.QuizSession, error) {
	return f.session, nil
}
func (f *fakeSessionRepo) GetByPIN(context.Context, string) (*entities.QuizSession, error) {
	return f.session, nil
}
func (f *fakeSessionRepo) GetActiveByQuizID(context.Context, uuid.UUID) (*entities.QuizSession, error) {
	return f.session, nil
}
func (f *fakeSessionRepo) Create(context.Context, *entities.QuizSession) error { return nil }
func (f *fakeSessionRepo) Update(context.Context, *entities.QuizSession) error { return nil }
func (f *fakeSessionRepo) Delete(context.Context, uuid.UUID) error             { return nil }
func (f *fakeSessionRepo) List(context.Context, repo.QuizSessionFilter) ([]*entities.QuizSession, error) {
	return nil, nil
}

type fakePlayerRepo struct {
	created *entities.QuizPlayer
}

func (f *fakePlayerRepo) Create(_ context.Context, p *entities.QuizPlayer) error {
	f.created = p
	return nil
}
func (f *fakePlayerRepo) GetByID(context.Context, uuid.UUID) (*entities.QuizPlayer, error) {
	return nil, nil
}
func (f *fakePlayerRepo) ListBySessionID(context.Context, uuid.UUID) ([]*entities.QuizPlayer, error) {
	return nil, nil
}
func (f *fakePlayerRepo) AddScore(context.Context, uuid.UUID, int) (int, error) { return 0, nil }
func (f *fakePlayerRepo) Delete(context.Context, uuid.UUID) error               { return nil }

func session(status enums.QuizSessionStatus) *entities.QuizSession {
	return &entities.QuizSession{ID: uuid.New(), Status: status}
}

// Late joining is deliberate — see the decision recorded against D6. It is
// also the path a player takes when rejoining after a disconnect, so these
// tests exist to stop it being "tidied up" back into a lobby-only check.

func TestJoinSessionAllowsJoiningAGameInProgress(t *testing.T) {
	playerRepo := &fakePlayerRepo{}
	uc := NewQuizPlayerUseCase(&fakeSessionRepo{session: session(enums.QuizSessionStatusActive)}, playerRepo)

	player, err := uc.JoinSession(context.Background(), uuid.New(), "latecomer")
	if err != nil {
		t.Fatalf("JoinSession on an active session: %v", err)
	}
	if player == nil {
		t.Fatal("no player returned")
	}
	if player.Score != 0 {
		t.Errorf("Score = %d, want 0 — a late joiner starts fresh", player.Score)
	}
}

func TestJoinSessionAllowsJoiningALobby(t *testing.T) {
	uc := NewQuizPlayerUseCase(&fakeSessionRepo{session: session(enums.QuizSessionStatusLobby)}, &fakePlayerRepo{})

	if _, err := uc.JoinSession(context.Background(), uuid.New(), "early"); err != nil {
		t.Fatalf("JoinSession on a lobby: %v", err)
	}
}

func TestJoinSessionRejectsAFinishedGame(t *testing.T) {
	playerRepo := &fakePlayerRepo{}
	uc := NewQuizPlayerUseCase(&fakeSessionRepo{session: session(enums.QuizSessionStatusFinished)}, playerRepo)

	// The one state that cannot be joined: nothing left to answer and the
	// leaderboard is final. respondError maps this to 422.
	_, err := uc.JoinSession(context.Background(), uuid.New(), "too late")
	if !errors.Is(err, domainErrors.ErrSessionFinished) {
		t.Errorf("err = %v, want ErrSessionFinished", err)
	}
	if playerRepo.created != nil {
		t.Error("a player was created for a finished session")
	}
}

func TestJoinSessionRejectsAMissingSession(t *testing.T) {
	// Repositories signal "not found" as (nil, nil).
	uc := NewQuizPlayerUseCase(&fakeSessionRepo{session: nil}, &fakePlayerRepo{})

	_, err := uc.JoinSession(context.Background(), uuid.New(), "nobody")
	if !errors.Is(err, domainErrors.ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestJoinSessionRequiresAName(t *testing.T) {
	uc := NewQuizPlayerUseCase(&fakeSessionRepo{session: session(enums.QuizSessionStatusLobby)}, &fakePlayerRepo{})

	if _, err := uc.JoinSession(context.Background(), uuid.New(), ""); err == nil {
		t.Error("an empty nickname was accepted")
	}
}
