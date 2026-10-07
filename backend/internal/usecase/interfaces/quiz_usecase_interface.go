package interfaces

import (
	"context"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"

	"github.com/google/uuid"
)

// QuizFilter for listing quizzes
type QuizFilter struct {
	Status *enums.QuizStatus
}

// QuizUseCase handles quiz CRUD business logic
type QuizUseCase interface {
	// Create creates new quiz in Draft status
	Create(ctx context.Context, quiz *entities.Quiz) error
	// Update updates mutable fields. Archived quizzes cannot be updated.
	Update(ctx context.Context, quiz *entities.Quiz) error
	// Activate publishes a Draft quiz so sessions can be created for it
	Activate(ctx context.Context, quizID uuid.UUID) error
	// Archive retires a quiz; no new sessions allowed after this
	Archive(ctx context.Context, quizID uuid.UUID) error
	// Delete removes quiz and all child records
	Delete(ctx context.Context, quizID uuid.UUID) error
	// GetByID retrieves quiz by primary key
	GetByID(ctx context.Context, quizID uuid.UUID) (*entities.Quiz, error)
	// List returns quizzes matching optional filter
	List(ctx context.Context, filter QuizFilter) ([]*entities.Quiz, error)
}

// QuizQuestionUseCase handles question management within a quiz
type QuizQuestionUseCase interface {
	// Create adds a new question to a quiz
	Create(ctx context.Context, question *entities.QuizQuestion) error
	// Update modifies an existing question. quizID scopes the lookup: a
	// question belonging to another quiz reports not-found rather than being
	// rewritten.
	Update(ctx context.Context, quizID uuid.UUID, question *entities.QuizQuestion) error
	// Delete removes a question, scoped to its quiz for the same reason.
	Delete(ctx context.Context, quizID, questionID uuid.UUID) error
	// GetByID retrieves a question by primary key
	GetByID(ctx context.Context, questionID uuid.UUID) (*entities.QuizQuestion, error)
	// ListByQuizID returns all questions for a quiz ordered by position
	ListByQuizID(ctx context.Context, quizID uuid.UUID) ([]*entities.QuizQuestion, error)
	// ReplaceQuestions makes the quiz's questions match the given slice
	// exactly, in a single transaction. Position is taken from the slice
	// order, so the caller does not have to keep it consistent itself.
	ReplaceQuestions(ctx context.Context, quizID uuid.UUID, questions []*entities.QuizQuestion) error
}

// QuizSessionUseCase manages live game session lifecycle
type QuizSessionUseCase interface {
	// CreateSession creates a lobby session with a unique PIN for a quiz.
	// The quiz must be Active.
	CreateSession(ctx context.Context, quizID, hostID uuid.UUID) (*entities.QuizSession, error)
	// StartSession transitions a lobby session to active.
	// Broadcasts are handled by the WebSocket hub; this persists the state change.
	StartSession(ctx context.Context, sessionID uuid.UUID) error
	// AdvanceQuestion sets the next question as current on an active session.
	// Returns the question that was set, so the caller can broadcast it.
	AdvanceQuestion(ctx context.Context, sessionID, questionID uuid.UUID) (*entities.QuizQuestion, error)
	// FinishSession marks the session as finished and records the finished_at timestamp.
	FinishSession(ctx context.Context, sessionID uuid.UUID) error
	// GetByID retrieves a session by primary key
	GetByID(ctx context.Context, sessionID uuid.UUID) (*entities.QuizSession, error)
	// GetByPIN retrieves a session by its join PIN (player join flow)
	GetByPIN(ctx context.Context, pin string) (*entities.QuizSession, error)
	// GetActiveSessionByQuizID retrieves the current active or lobby session for a given quiz ID
	GetActiveSessionByQuizID(ctx context.Context, quizID uuid.UUID) (*entities.QuizSession, error)
	// CurrentQuestion returns the live question of an active session, or nil
	// when none is live. A reconnecting player is resynced with it.
	CurrentQuestion(ctx context.Context, session *entities.QuizSession) (*entities.QuizQuestion, error)
}

// QuizPlayerUseCase handles players joining and their score state
type QuizPlayerUseCase interface {
	// JoinSession adds a player to a session.
	//
	// Joining a game already in progress is allowed by design — it is also how
	// a disconnected player rejoins. The late joiner starts at 0 points on the
	// current question.
	//
	// Returns ErrSessionFinished if the game is over, and
	// ErrDuplicatePlayerName if the nickname is taken.
	//
	// avatarID and avatarURL are mutually exclusive picks from the join
	// screen — either or both may be nil if the player hasn't picked one.
	JoinSession(ctx context.Context, sessionID uuid.UUID, name string, avatarID *int16, avatarURL *string) (*entities.QuizPlayer, error)
	// GetPlayer retrieves a single player by ID. Returns (nil, nil) if no such
	// player exists. Callers must confirm the player belongs to the session
	// they are acting on — the player ID arrives from the client.
	GetPlayer(ctx context.Context, playerID uuid.UUID) (*entities.QuizPlayer, error)
	// GetLeaderboard returns all players in a session sorted by score DESC
	GetLeaderboard(ctx context.Context, sessionID uuid.UUID) ([]*entities.QuizPlayer, error)
}

// QuizAnswerUseCase handles player answer submission and scoring
type QuizAnswerUseCase interface {
	// SubmitAnswer records a player's answer, calculates the score, and
	// updates the player's cumulative total. Returns the awarded score and
	// the updated leaderboard so the caller can broadcast both.
	SubmitAnswer(ctx context.Context, input SubmitAnswerInput) (*SubmitAnswerResult, error)

	// QuestionResults summarises the session's current question once it has
	// closed: the right answer and how many players picked each option. The
	// host screen draws its bar chart from this.
	QuestionResults(ctx context.Context, sessionID uuid.UUID) (*QuestionResults, error)
}

// QuestionResults is what the room sees when a question closes.
type QuestionResults struct {
	QuestionID    uuid.UUID
	CorrectAnswer map[string]any
	// Distribution maps each submitted answer to how many players chose it.
	Distribution map[string]int
	Answered     int
	Players      int
}

// SubmitAnswerInput carries all data needed to score a single player answer
type SubmitAnswerInput struct {
	PlayerID    uuid.UUID
	SessionID   uuid.UUID
	QuestionID  uuid.UUID
	Answer      map[string]any // {"value": "Go"} | {"value": true} | {"text": "..."}
	TimeTakenMs int            // Milliseconds elapsed since question was broadcast
}

// SubmitAnswerResult is returned after scoring an answer
type SubmitAnswerResult struct {
	IsCorrect bool
	// ScoreAwarded is the final points for this answer, streak bonus included.
	ScoreAwarded int
	// Streak is the number of correct answers in a row, ending with this one
	// (0 after a wrong answer). StreakBonus is the part of ScoreAwarded it earned.
	Streak      int
	StreakBonus int
	// TotalScore is the player's running total; Rank is their 1-based place.
	TotalScore  int
	Rank        int
	Leaderboard []*entities.QuizPlayer
	// AlreadyAnswered is true when this was a repeat submission: the original
	// result is returned instead of an error, and nothing was scored again.
	AlreadyAnswered bool
}
