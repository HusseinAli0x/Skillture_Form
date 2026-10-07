package quiz

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"
	uc "skillture/backend/internal/usecase/interfaces"

	"github.com/google/uuid"
)

// quizSessionUseCase is the concrete implementation of QuizSessionUseCase.
type quizSessionUseCase struct {
	quizRepo     repo.QuizRepository
	questionRepo repo.QuizQuestionRepository
	sessionRepo  repo.QuizSessionRepository
}

// Compile-time assertion
var _ uc.QuizSessionUseCase = (*quizSessionUseCase)(nil)

// NewQuizSessionUseCase creates a new QuizSessionUseCase.
func NewQuizSessionUseCase(
	quizRepo repo.QuizRepository,
	questionRepo repo.QuizQuestionRepository,
	sessionRepo repo.QuizSessionRepository,
) uc.QuizSessionUseCase {
	return &quizSessionUseCase{
		quizRepo:     quizRepo,
		questionRepo: questionRepo,
		sessionRepo:  sessionRepo,
	}
}

// generatePIN generates a cryptographically random 6-digit numeric PIN.
// Retries up to 10 times to avoid collisions (handled by UNIQUE index).
func generatePIN() (string, error) {
	b := make([]byte, 3) // 3 bytes = max 16 million values, trim to 6 digits
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generatePIN: %w", err)
	}
	n := (int(b[0])<<16 | int(b[1])<<8 | int(b[2])) % 1_000_000
	return fmt.Sprintf("%06d", n), nil
}

// CreateSession creates a new lobby session for an active quiz.
// Generates a unique 6-digit PIN that players use to join.
func (u *quizSessionUseCase) CreateSession(ctx context.Context, quizID, hostID uuid.UUID) (*entities.QuizSession, error) {
	// Quiz must be active before hosting
	quiz, err := u.quizRepo.GetByID(ctx, quizID)
	if err != nil {
		return nil, err
	}
	if quiz == nil {
		return nil, errors.New("quiz not found")
	}
	if !quiz.IsActive() {
		return nil, domainErrors.ErrQuizNotActive
	}

	// Quiz must have at least one question
	questions, err := u.questionRepo.List(ctx, repo.QuizQuestionFilter{QuizID: &quizID})
	if err != nil {
		return nil, err
	}
	if len(questions) == 0 {
		return nil, errors.New("quiz has no questions")
	}

	pin, err := generatePIN()
	if err != nil {
		return nil, err
	}

	session := &entities.QuizSession{
		ID:     uuid.New(),
		QuizID: quizID,
		HostID: &hostID,
		PIN:    pin,
		Status: enums.QuizSessionStatusLobby,
	}

	if err := u.sessionRepo.Create(ctx, session); err != nil {
		return nil, fmt.Errorf("CreateSession: %w", err)
	}

	return session, nil
}

// StartSession transitions a lobby session to active.
// Players can no longer join after this point.
func (u *quizSessionUseCase) StartSession(ctx context.Context, sessionID uuid.UUID) error {
	session, err := u.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return err
	}
	if session == nil {
		return errors.New("session not found")
	}
	if !session.IsLobby() {
		return domainErrors.ErrSessionAlreadyStarted
	}

	now := time.Now()
	session.Status = enums.QuizSessionStatusActive
	session.StartedAt = &now

	return u.sessionRepo.Update(ctx, session)
}

// AdvanceQuestion sets the next question as the current one on an active session.
// Returns the full question entity so the WebSocket hub can broadcast it to players.
func (u *quizSessionUseCase) AdvanceQuestion(ctx context.Context, sessionID, questionID uuid.UUID) (*entities.QuizQuestion, error) {
	session, err := u.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, errors.New("session not found")
	}
	if !session.IsActive() {
		return nil, domainErrors.ErrSessionNotActive
	}

	question, err := u.questionRepo.GetByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	if question == nil {
		return nil, errors.New("question not found")
	}
	// Verify question belongs to the quiz in this session
	if question.QuizID != session.QuizID {
		return nil, errors.New("question does not belong to this quiz")
	}

	session.CurrentQuestionID = &questionID
	if err := u.sessionRepo.Update(ctx, session); err != nil {
		return nil, err
	}

	return question, nil
}

// FinishSession marks the session as finished and records the finished_at timestamp.
func (u *quizSessionUseCase) FinishSession(ctx context.Context, sessionID uuid.UUID) error {
	session, err := u.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return err
	}
	if session == nil {
		return errors.New("session not found")
	}
	if session.IsFinished() {
		return domainErrors.ErrSessionFinished
	}

	now := time.Now()
	session.Status = enums.QuizSessionStatusFinished
	session.FinishedAt = &now
	session.CurrentQuestionID = nil

	return u.sessionRepo.Update(ctx, session)
}

// GetByID retrieves a session by primary key.
func (u *quizSessionUseCase) GetByID(ctx context.Context, sessionID uuid.UUID) (*entities.QuizSession, error) {
	session, err := u.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, errors.New("session not found")
	}
	return session, nil
}

// GetByPIN retrieves a session by its join PIN.
func (u *quizSessionUseCase) GetByPIN(ctx context.Context, pin string) (*entities.QuizSession, error) {
	if pin == "" {
		return nil, domainErrors.ErrInvalidInput
	}
	session, err := u.sessionRepo.GetByPIN(ctx, pin)
	if err != nil {
		return nil, fmt.Errorf("GetByPIN: %w", err)
	}
	if session == nil {
		return nil, domainErrors.ErrNotFound
	}
	return session, nil
}

// GetActiveSessionByQuizID retrieves the latest active or lobby session for a given quiz ID
func (u *quizSessionUseCase) GetActiveSessionByQuizID(ctx context.Context, quizID uuid.UUID) (*entities.QuizSession, error) {
	// 1. Try to find an Active session first
	statusActive := enums.QuizSessionStatusActive
	sessions, err := u.sessionRepo.List(ctx, repo.QuizSessionFilter{QuizID: &quizID, Status: &statusActive})
	if err != nil {
		return nil, err
	}
	if len(sessions) > 0 {
		return sessions[0], nil
	}

	// 2. If no Active session, look for a Lobby session
	statusLobby := enums.QuizSessionStatusLobby
	sessions, err = u.sessionRepo.List(ctx, repo.QuizSessionFilter{QuizID: &quizID, Status: &statusLobby})
	if err != nil {
		return nil, err
	}
	if len(sessions) > 0 {
		return sessions[0], nil
	}

	return nil, domainErrors.ErrNotFound
}

// CurrentQuestion returns the live question of an active session, or nil when
// the session has none (lobby, between games, finished).
func (u *quizSessionUseCase) CurrentQuestion(ctx context.Context, session *entities.QuizSession) (*entities.QuizQuestion, error) {
	if session == nil || !session.IsActive() || session.CurrentQuestionID == nil {
		return nil, nil
	}
	return u.questionRepo.GetByID(ctx, *session.CurrentQuestionID)
}
