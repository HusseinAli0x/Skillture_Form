package quiz

import (
	"context"
	"errors"
	"fmt"
	"strings"

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

	// --- 5. Guard against double-answer ---
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
	scoreAwarded := 0
	if isCorrect {
		scoreAwarded = calculateScore(question.Points, question.TimeLimitSec, input.TimeTakenMs)
	}

	// --- 8. Persist the answer ---
	answer := &entities.QuizPlayerAnswer{
		PlayerID:     input.PlayerID,
		SessionID:    input.SessionID,
		QuestionID:   input.QuestionID,
		Answer:       input.Answer,
		IsCorrect:    isCorrect,
		ScoreAwarded: scoreAwarded,
		TimeTakenMs:  input.TimeTakenMs,
	}
	if err := u.answerRepo.Create(ctx, answer); err != nil {
		return nil, fmt.Errorf("SubmitAnswer: persist answer: %w", err)
	}

	// --- 9. Update player cumulative score ---
	player.AddScore(scoreAwarded)
	if err := u.playerRepo.UpdateScore(ctx, player.ID, player.Score); err != nil {
		return nil, fmt.Errorf("SubmitAnswer: update score: %w", err)
	}

	// --- 10. Fetch fresh leaderboard for broadcast ---
	leaderboard, err := u.playerRepo.ListBySessionID(ctx, input.SessionID)
	if err != nil {
		return nil, fmt.Errorf("SubmitAnswer: leaderboard: %w", err)
	}

	return &uc.SubmitAnswerResult{
		IsCorrect:    isCorrect,
		ScoreAwarded: scoreAwarded,
		Leaderboard:  leaderboard,
	}, nil
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
		// Short answers: case-insensitive, trimmed string match
		correct, ok := question.CorrectAnswer["text"].(string)
		if !ok {
			return false
		}
		submitted, ok := playerAnswer["text"].(string)
		if !ok {
			return false
		}
		return strings.EqualFold(strings.TrimSpace(correct), strings.TrimSpace(submitted))
	}

	return false
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
