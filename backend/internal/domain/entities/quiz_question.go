package entities

import (
	"skillture/backend/internal/domain/enums"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Domain errors for the QuizQuestion entity
var (
	ErrInvalidQuestionType    = errors.New("invalid quiz question type")
	ErrMissingQuestionText    = errors.New("question text is missing")
	ErrMissingCorrectAnswer   = errors.New("correct answer is missing")
	ErrMissingOptionsForMCQ   = errors.New("mcq question requires options")
	ErrInvalidTimeLimit       = errors.New("time limit must be greater than zero")
	ErrInvalidPoints          = errors.New("points must be greater than zero")
)

// QuizQuestion represents a single question within a quiz.
// The question text, options, and correct_answer are all stored as
// JSONB for multilingual support: {"en": "...", "ar": "..."}.
type QuizQuestion struct {
	ID           uuid.UUID             `db:"id"             json:"id"`
	QuizID       uuid.UUID             `db:"quiz_id"        json:"quiz_id"`
	Question     map[string]string     `db:"question"       json:"question"`
	Type         enums.QuizQuestionType `db:"type"          json:"type"`
	Position     int                   `db:"position"       json:"position"`
	TimeLimitSec int                   `db:"time_limit_sec" json:"time_limit_sec"` // Seconds
	Points       int                   `db:"points"         json:"points"`          // Max base points
	Options      map[string]any        `db:"options"        json:"options,omitempty"` // MCQ/TF only
	CorrectAnswer map[string]any       `db:"correct_answer" json:"correct_answer"`
	CreatedAt    time.Time             `db:"created_at"     json:"created_at"`
	UpdatedAt    time.Time             `db:"updated_at"     json:"updated_at"`
}

// TableName returns the PostgreSQL table name
func (QuizQuestion) TableName() string {
	return "quiz_questions"
}

// IsMCQ returns true if this is a multiple-choice question
func (qq *QuizQuestion) IsMCQ() bool {
	return qq.Type == enums.QuizQuestionTypeMCQ
}

// IsTF returns true if this is a True/False question
func (qq *QuizQuestion) IsTF() bool {
	return qq.Type == enums.QuizQuestionTypeTF
}

// IsShort returns true if this is a short-answer question
func (qq *QuizQuestion) IsShort() bool {
	return qq.Type == enums.QuizQuestionTypeShort
}

// RequiresOptions returns true for types that must have options defined (MCQ and TF)
func (qq *QuizQuestion) RequiresOptions() bool {
	return qq.Type == enums.QuizQuestionTypeMCQ || qq.Type == enums.QuizQuestionTypeTF
}

// GetQuestion returns the question text in the requested language, falling back to English
func (qq *QuizQuestion) GetQuestion(lang string) string {
	if val, ok := qq.Question[lang]; ok && val != "" {
		return val
	}
	if val, ok := qq.Question["en"]; ok {
		return val
	}
	return ""
}

// IsValid validates domain-level rules for a QuizQuestion
func (qq *QuizQuestion) IsValid() error {
	if len(qq.Question) == 0 {
		return ErrMissingQuestionText
	}
	if !qq.Type.IsValid() {
		return ErrInvalidQuestionType
	}
	if qq.RequiresOptions() && len(qq.Options) == 0 {
		return ErrMissingOptionsForMCQ
	}
	if len(qq.CorrectAnswer) == 0 {
		return ErrMissingCorrectAnswer
	}
	if qq.TimeLimitSec <= 0 {
		return ErrInvalidTimeLimit
	}
	if qq.Points <= 0 {
		return ErrInvalidPoints
	}
	return nil
}
