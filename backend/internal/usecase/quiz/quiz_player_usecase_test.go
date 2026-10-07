package quiz

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

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
func (f *fakeSessionRepo) FinishStale(context.Context, time.Time) (int64, error) { return 0, nil }
func (f *fakeSessionRepo) Create(context.Context, *entities.QuizSession) error   { return nil }
func (f *fakeSessionRepo) Update(context.Context, *entities.QuizSession) error   { return nil }
func (f *fakeSessionRepo) Delete(context.Context, uuid.UUID) error               { return nil }
func (f *fakeSessionRepo) List(context.Context, repo.QuizSessionFilter) ([]*entities.QuizSession, error) {
	return nil, nil
}

type fakePlayerRepo struct {
	created *entities.QuizPlayer
	count   int
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
func (f *fakePlayerRepo) CountBySessionID(context.Context, uuid.UUID) (int, error) {
	return f.count, nil
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

	player, err := uc.JoinSession(context.Background(), uuid.New(), "latecomer", nil, nil)
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

	if _, err := uc.JoinSession(context.Background(), uuid.New(), "early", nil, nil); err != nil {
		t.Fatalf("JoinSession on a lobby: %v", err)
	}
}

func TestJoinSessionRejectsAFinishedGame(t *testing.T) {
	playerRepo := &fakePlayerRepo{}
	uc := NewQuizPlayerUseCase(&fakeSessionRepo{session: session(enums.QuizSessionStatusFinished)}, playerRepo)

	// The one state that cannot be joined: nothing left to answer and the
	// leaderboard is final. respondError maps this to 422.
	_, err := uc.JoinSession(context.Background(), uuid.New(), "too late", nil, nil)
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

	_, err := uc.JoinSession(context.Background(), uuid.New(), "nobody", nil, nil)
	if !errors.Is(err, domainErrors.ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestJoinSessionRequiresAName(t *testing.T) {
	uc := NewQuizPlayerUseCase(&fakeSessionRepo{session: session(enums.QuizSessionStatusLobby)}, &fakePlayerRepo{})

	if _, err := uc.JoinSession(context.Background(), uuid.New(), "", nil, nil); err == nil {
		t.Error("an empty nickname was accepted")
	}
}

// ---- What a joining player may send --------------------------------------
//
// Anyone holding a PIN can call JoinSession, and whatever they send is stored
// and pushed to every screen in the room.

func lobbyUC(repo *fakePlayerRepo) *quizPlayerUseCase {
	return NewQuizPlayerUseCase(&fakeSessionRepo{session: session(enums.QuizSessionStatusLobby)}, repo).(*quizPlayerUseCase)
}

func strp(s string) *string { return &s }

func TestJoinSessionCleansTheName(t *testing.T) {
	repo := &fakePlayerRepo{}
	p, err := lobbyUC(repo).JoinSession(context.Background(), uuid.New(), "  Sara   Ali  ", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if p.Name != "Sara Ali" {
		t.Errorf("name = %q, want whitespace collapsed", p.Name)
	}
}

func TestJoinSessionBoundsTheName(t *testing.T) {
	uc := lobbyUC(&fakePlayerRepo{})
	ctx := context.Background()

	if _, err := uc.JoinSession(ctx, uuid.New(), strings.Repeat("س", MaxPlayerNameLen), nil, nil); err != nil {
		t.Errorf("a name of exactly %d Arabic characters should be accepted: %v", MaxPlayerNameLen, err)
	}
	for name, bad := range map[string]string{
		"too long":        strings.Repeat("a", MaxPlayerNameLen+1),
		"huge":            strings.Repeat("a", 5_000_000),
		"whitespace only": " \t ",
		"control char":    "Sara\x00Ali",
	} {
		_, err := uc.JoinSession(ctx, uuid.New(), bad, nil, nil)
		if !errors.Is(err, domainErrors.ErrInvalidInput) {
			t.Errorf("%s: err = %v, want ErrInvalidInput", name, err)
		}
	}
}

func TestJoinSessionOnlyAcceptsInlineImagesAsAvatars(t *testing.T) {
	uc := lobbyUC(&fakePlayerRepo{})
	ctx := context.Background()

	for _, ok := range []string{
		"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==",
		"data:image/png;base64,iVBORw0KGgo=",
		"data:image/webp;base64,UklGRg",
		"data:image/gif;base64,R0lGODlh",
	} {
		if _, err := uc.JoinSession(ctx, uuid.New(), "p", nil, strp(ok)); err != nil {
			t.Errorf("avatar %q rejected: %v", ok, err)
		}
	}
	for name, bad := range map[string]string{
		"remote url (tracking pixel)": "https://attacker.example/pixel.gif",
		"protocol-relative":           "//attacker.example/p.png",
		"svg (can carry script)":      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
		"html":                        "data:text/html;base64,PGgxPg==",
		"not base64":                  "data:image/png;base64,***",
		"javascript":                  "javascript:alert(1)",
		"oversized":                   "data:image/jpeg;base64," + strings.Repeat("A", MaxAvatarDataURLLen),
	} {
		if _, err := uc.JoinSession(ctx, uuid.New(), "p", nil, strp(bad)); !errors.Is(err, domainErrors.ErrInvalidInput) {
			t.Errorf("%s: err = %v, want ErrInvalidInput", name, err)
		}
	}

	// An empty string means "no avatar", as the client sends it.
	p, err := uc.JoinSession(ctx, uuid.New(), "p", nil, strp(""))
	if err != nil || p.AvatarURL != nil {
		t.Errorf("empty avatar: %v, %v", p, err)
	}
}

func TestJoinSessionStopsAtTheRosterLimit(t *testing.T) {
	repo := &fakePlayerRepo{count: MaxPlayersPerSession}
	_, err := lobbyUC(repo).JoinSession(context.Background(), uuid.New(), "one too many", nil, nil)
	if !errors.Is(err, domainErrors.ErrSessionFull) {
		t.Errorf("err = %v, want ErrSessionFull", err)
	}
	if repo.created != nil {
		t.Error("a player was stored in a full game")
	}

	repo = &fakePlayerRepo{count: MaxPlayersPerSession - 1}
	if _, err := lobbyUC(repo).JoinSession(context.Background(), uuid.New(), "last seat", nil, nil); err != nil {
		t.Errorf("the last seat should be free: %v", err)
	}
}

func TestJoinSessionIssuesASecretAndStoresOnlyItsHash(t *testing.T) {
	repo := &fakePlayerRepo{}
	p, err := lobbyUC(repo).JoinSession(context.Background(), uuid.New(), "Sara", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if p.Secret == "" {
		t.Fatal("the joining player must receive a secret")
	}
	if repo.created == nil || repo.created.SecretHash == nil {
		t.Fatal("a hash must be stored")
	}
	if *repo.created.SecretHash == p.Secret {
		t.Fatal("the stored value must not be the secret itself")
	}
	if !repo.created.VerifySecret(p.Secret) || repo.created.VerifySecret("someone-else") {
		t.Fatal("the stored hash must verify exactly the issued secret")
	}

	// Two players never share a secret.
	other, _ := lobbyUC(&fakePlayerRepo{}).JoinSession(context.Background(), uuid.New(), "Omar", nil, nil)
	if other.Secret == p.Secret {
		t.Fatal("secrets must be unique")
	}
}
