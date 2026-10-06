package quiz

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"
	uc "skillture/backend/internal/usecase/interfaces"
)

// quizAnswerUseCase is the concrete implementation of QuizAnswerUseCase.
type quizAnswerUseCase struct {
	sessionRepo  repo.QuizSessionRepository
	questionRepo repo.QuizQuestionRepository
	playerRepo   repo.QuizPlayerRepository
	answerRepo   repo.QuizPlayerAnswerRepository
}

// Compile-time assertion
var _ uc.QuizAnswerUseCase = (*quizAnswerUseCase)(nil)

// NewQuizAnswerUseCase creates a new QuizAnswerUseCase.
func NewQuizAnswerUseCase(
	sessionRepo repo.QuizSessionRepository,
	questionRepo repo.QuizQuestionRepository,
	playerRepo repo.QuizPlayerRepository,
	answerRepo repo.QuizPlayerAnswerRepository,
) uc.QuizAnswerUseCase {
	return &quizAnswerUseCase{
		sessionRepo:  sessionRepo,
		questionRepo: questionRepo,
		playerRepo:   playerRepo,
		answerRepo:   answerRepo,
	}
}

// SubmitAnswer records a player's answer, calculates their score, updates their
// cumulative total, and returns the scored result plus the fresh leaderboard.
//
// Scoring formula (speed-based, same as Kahoot):
//
//	score = basePoints * (1 - timeTaken / (timeLimit * 1000)) * 0.5 + basePoints * 0.5
//
// Simplified: correct answers always earn at least 50% of base points,
// and earn up to 100% if answered instantly.
func (u *quizAnswerUseCase) SubmitAnswer(ctx context.Context, input uc.SubmitAnswerInput) (*uc.SubmitAnswerResult, error) {
	// --- 1. Validate session is active ---
	session, err := u.sessionRepo.GetByID(ctx, input.SessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, errors.New("session not found")
	}
	if !session.IsActive() {
		return nil, domainErrors.ErrSessionNotActive
	}

	// --- 2. Question must be the currently live question ---
	if session.CurrentQuestionID == nil || *session.CurrentQuestionID != input.QuestionID {
		return nil, domainErrors.ErrQuestionNotCurrent
	}

	// --- 3. Fetch question for scoring ---
	question, err := u.questionRepo.GetByID(ctx, input.QuestionID)
	if err != nil {
		return nil, err
	}
	if question == nil {
		return nil, errors.New("question not found")
	}

	// --- 4. Fetch player ---
	player, err := u.playerRepo.GetByID(ctx, input.PlayerID)
	if err != nil {
		return nil, err
	}
	if player == nil {
		return nil, errors.New("player not found")
	}

	// The player ID arrives from the client, so existence is not enough —
	// without this a player from one session could score into another.
	if player.SessionID != input.SessionID {
		return nil, domainErrors.ErrPlayerNotInSession
	}

	// --- 5. Guard against double-answer ---
	// This is a fast path for the common case only. The authoritative guard is
	// the uq_player_question_answer unique index, checked after the insert
	// below, because two concurrent submissions can both pass this check.
	alreadyAnswered, err := u.answerRepo.ExistsByPlayerAndQuestion(ctx, input.PlayerID, input.QuestionID)
	if err != nil {
		return nil, err
	}
	if alreadyAnswered {
		return nil, domainErrors.ErrAlreadyAnswered
	}

	// --- 6. Check correctness ---
	isCorrect := checkAnswer(question, input.Answer)

	// --- 7. Calculate score ---
	timeTakenMs := clampTimeTaken(input.TimeTakenMs, question.TimeLimitSec)
	scoreAwarded := 0
	streak, streakBonus := 0, 0
	if isCorrect {
		scoreAwarded = calculateScore(question.Points, question.TimeLimitSec, timeTakenMs)

		// Streaks: each correct answer in a row adds 10% of that answer's
		// points, up to +50%. A wrong answer resets it.
		previous, err := u.answerRepo.List(ctx, repo.QuizPlayerAnswerFilter{PlayerID: &input.PlayerID, SessionID: &input.SessionID})
		if err != nil {
			return nil, fmt.Errorf("SubmitAnswer: read streak: %w", err)
		}
		streak = correctStreak(previous) + 1
		streakBonus = streakBonusFor(scoreAwarded, streak)
		scoreAwarded += streakBonus
	}

	// --- 8. Persist the answer ---
	answer := &entities.QuizPlayerAnswer{
		PlayerID:     input.PlayerID,
		SessionID:    input.SessionID,
		QuestionID:   input.QuestionID,
		Answer:       input.Answer,
		IsCorrect:    isCorrect,
		ScoreAwarded: scoreAwarded,
		TimeTakenMs:  timeTakenMs,
	}
	if err := u.answerRepo.Create(ctx, answer); err != nil {
		// The unique index fired: another request for this player/question won
		// the race. Report it as a duplicate rather than a 500.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return nil, domainErrors.ErrAlreadyAnswered
		}
		return nil, fmt.Errorf("SubmitAnswer: persist answer: %w", err)
	}

	// --- 9. Update player cumulative score ---
	// Incremented in SQL. Computing the new total in Go and writing it back
	// lost points whenever two answers were scored concurrently.
	total, err := u.playerRepo.AddScore(ctx, player.ID, scoreAwarded)
	if err != nil {
		return nil, fmt.Errorf("SubmitAnswer: update score: %w", err)
	}

	// --- 10. Fetch fresh leaderboard for broadcast ---
	leaderboard, err := u.playerRepo.ListBySessionID(ctx, input.SessionID)
	if err != nil {
		return nil, fmt.Errorf("SubmitAnswer: leaderboard: %w", err)
	}

	rank := 0
	for i, p := range leaderboard {
		if p.ID == player.ID {
			rank = i + 1
			break
		}
	}

	return &uc.SubmitAnswerResult{
		IsCorrect:    isCorrect,
		ScoreAwarded: scoreAwarded,
		Streak:       streak,
		StreakBonus:  streakBonus,
		TotalScore:   total,
		Rank:         rank,
		Leaderboard:  leaderboard,
	}, nil
}

// QuestionResults reports the correct answer and the vote split for the
// session's current question.
func (u *quizAnswerUseCase) QuestionResults(ctx context.Context, sessionID uuid.UUID) (*uc.QuestionResults, error) {
	session, err := u.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, errors.New("session not found")
	}
	if session.CurrentQuestionID == nil {
		return nil, domainErrors.ErrQuestionNotCurrent
	}
	question, err := u.questionRepo.GetByID(ctx, *session.CurrentQuestionID)
	if err != nil {
		return nil, err
	}
	if question == nil {
		return nil, errors.New("question not found")
	}
	answers, err := u.answerRepo.List(ctx, repo.QuizPlayerAnswerFilter{SessionID: &sessionID, QuestionID: session.CurrentQuestionID})
	if err != nil {
		return nil, err
	}
	players, err := u.playerRepo.ListBySessionID(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	distribution := make(map[string]int)
	for _, a := range answers {
		distribution[answerKey(a.Answer)]++
	}
	return &uc.QuestionResults{
		QuestionID:    question.ID,
		CorrectAnswer: question.CorrectAnswer,
		Distribution:  distribution,
		Answered:      len(answers),
		Players:       len(players),
	}, nil
}

// correctStreak counts the correct answers at the end of a player's history
// (oldest first), i.e. the streak they carry into the next question.
func correctStreak(history []*entities.QuizPlayerAnswer) int {
	n := 0
	for i := len(history) - 1; i >= 0 && history[i].IsCorrect; i-- {
		n++
	}
	return n
}

// streakBonusFor is 10% of the base points per streak step beyond the first,
// capped at +50%.
func streakBonusFor(base, streak int) int {
	steps := streak - 1
	if steps <= 0 {
		return 0
	}
	if steps > 5 {
		steps = 5
	}
	return base * steps / 10
}

// answerKey is the string a submitted answer is grouped under in the vote
// split, whichever key (`value` for choices, `text` for short answers) it used.
func answerKey(answer map[string]any) string {
	for _, k := range []string{"value", "text"} {
		if v, ok := answer[k]; ok {
			return normaliseAnswer(fmt.Sprintf("%v", v))
		}
	}
	return ""
}

// normaliseAnswer trims and collapses whitespace so "  Cairo " and "Cairo"
// compare equal.
func normaliseAnswer(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

// checkAnswer compares the player's submitted answer against the question's
// correct_answer JSONB field. Comparison is type-aware per question type.
func checkAnswer(question *entities.QuizQuestion, playerAnswer map[string]any) bool {
	if len(playerAnswer) == 0 || len(question.CorrectAnswer) == 0 {
		return false
	}

	switch question.Type {
	case enums.QuizQuestionTypeMCQ, enums.QuizQuestionTypeTF:
		// Both sides store answer under key "value"
		correct, ok := question.CorrectAnswer["value"]
		if !ok {
			return false
		}
		submitted, ok := playerAnswer["value"]
		if !ok {
			return false
		}
		// Normalise to string for comparison (handles bool/string JSON values)
		return fmt.Sprintf("%v", correct) == fmt.Sprintf("%v", submitted)

	case enums.QuizQuestionTypeShort:
		// The quiz builder stores a short question's answer under "value"
		// like every other type, while the player screen may send "text".
		// This used to read only "text" on both sides, so a short answer could
		// never be marked correct. Accept either key, ignore case and spacing.
		correct := answerKey(question.CorrectAnswer)
		submitted := answerKey(playerAnswer)
		if correct == "" || submitted == "" {
			return false
		}
		return strings.EqualFold(correct, submitted)
	}

	return false
}

// clampTimeTaken bounds the client-reported elapsed time to [0, timeLimit].
//
// TimeTakenMs is measured in the browser and sent by the player, so it is not
// trustworthy. A negative value produced a speed ratio above 1 and therefore a
// score above the question's base points — `time_taken_ms: -999999` was a
// one-line cheat.
func clampTimeTaken(timeTakenMs, timeLimitSec int) int {
	if timeTakenMs < 0 {
		return 0
	}
	if timeLimitSec > 0 && timeTakenMs > timeLimitSec*1000 {
		return timeLimitSec * 1000
	}
	return timeTakenMs
}

// calculateScore computes speed-based points.
// Score = basePoints * (0.5 + 0.5 * speedRatio)
// where speedRatio = 1 - timeTakenMs / (timeLimitSec * 1000).
// Minimum score for a correct answer is basePoints * 0.5 (answered at the last millisecond).
// Maximum score is basePoints (answered instantly).
func calculateScore(basePoints, timeLimitSec, timeTakenMs int) int {
	if timeLimitSec <= 0 {
		return basePoints
	}
	timeLimitMs := timeLimitSec * 1000
	if timeTakenMs >= timeLimitMs {
		// Answered exactly on the buzzer — minimum points
		return basePoints / 2
	}
	speedRatio := 1.0 - float64(timeTakenMs)/float64(timeLimitMs)
	score := float64(basePoints) * (0.5 + 0.5*speedRatio)
	return int(score)
}
