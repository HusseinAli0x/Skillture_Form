package entities

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Domain errors for the QuizPlayerAnswer entity
var (
	ErrMissingAnswerPlayerID   = errors.New("answer player ID is missing")
	ErrMissingAnswerSessionID  = errors.New("answer session ID is missing")
	ErrMissingAnswerQuestionID = errors.New("answer question ID is missing")
	ErrMissingAnswerValue      = errors.New("answer value is missing")
	ErrNegativeTimeTaken       = errors.New("time taken cannot be negative")
)

// QuizPlayerAnswer records a single answer submitted by a player during a live session.
// score_awarded is calculated by the server using speed-based scoring:
//
//	score = base_points * accuracy_factor * (1 - time_taken / time_limit)
//
// The answer payload uses the same JSONB map[string]any pattern as ResponseAnswer.Value.
type QuizPlayerAnswer struct {
	ID           uuid.UUID      `db:"id"            json:"id"`
	PlayerID     uuid.UUID      `db:"player_id"     json:"player_id"`
	SessionID    uuid.UUID      `db:"session_id"    json:"session_id"`
	QuestionID   uuid.UUID      `db:"question_id"   json:"question_id"`
	Answer       map[string]any `db:"answer"        json:"answer"` // {"value": "Go"} or {"value": true}
	IsCorrect    bool           `db:"is_correct"    json:"is_correct"`
	ScoreAwarded int            `db:"score_awarded" json:"score_awarded"` // Final points after speed calculation
	TimeTakenMs  int            `db:"time_taken_ms" json:"time_taken_ms"` // Response time in milliseconds
	AnsweredAt   time.Time      `db:"answered_at"   json:"answered_at"`
}

// TableName returns the PostgreSQL table name
func (QuizPlayerAnswer) TableName() string {
	return "quiz_player_answers"
}

// GetAnswerValue is a convenience helper to extract the raw answer value
func (pa *QuizPlayerAnswer) GetAnswerValue() any {
	if pa.Answer == nil {
		return nil
	}
	return pa.Answer["value"]
}

// IsValid validates domain-level rules for a QuizPlayerAnswer
func (pa *QuizPlayerAnswer) IsValid() error {
	if pa.PlayerID == uuid.Nil {
		return ErrMissingAnswerPlayerID
	}
	if pa.SessionID == uuid.Nil {
		return ErrMissingAnswerSessionID
	}
	if pa.QuestionID == uuid.Nil {
		return ErrMissingAnswerQuestionID
	}
	if len(pa.Answer) == 0 {
		return ErrMissingAnswerValue
	}
	if pa.TimeTakenMs < 0 {
		return ErrNegativeTimeTaken
	}
	return nil
}
