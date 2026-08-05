package entities

import (
	"skillture/backend/internal/domain/enums"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Domain errors for the QuizSession entity
var (
	ErrInvalidSessionStatus = errors.New("invalid quiz session status")
	ErrMissingQuizID        = errors.New("quiz ID is missing")
	ErrMissingHostID        = errors.New("host ID is missing")
	ErrMissingSessionPIN    = errors.New("session PIN is missing")
)

// QuizSession represents a single live game instance for a quiz.
// Created by the host when they choose to "Start" a quiz from the dashboard.
// Players join via the PIN before the game begins (lobby phase).
type QuizSession struct {
	ID                uuid.UUID                 `db:"id"                  json:"id"`
	QuizID            uuid.UUID                 `db:"quiz_id"             json:"quiz_id"`
	HostID            uuid.UUID                 `db:"host_id"             json:"host_id"`
	PIN               string                    `db:"pin"                 json:"pin"`
	Status            enums.QuizSessionStatus   `db:"status"              json:"status"`
	CurrentQuestionID *uuid.UUID                `db:"current_question_id" json:"current_question_id,omitempty"`
	CreatedAt         time.Time                 `db:"created_at"          json:"created_at"`
	StartedAt         *time.Time                `db:"started_at"          json:"started_at,omitempty"`
	FinishedAt        *time.Time                `db:"finished_at"         json:"finished_at,omitempty"`
}

// TableName returns the PostgreSQL table name
func (QuizSession) TableName() string {
	return "quiz_sessions"
}

// IsLobby returns true if players can still join (game not yet started)
func (qs *QuizSession) IsLobby() bool {
	return qs.Status == enums.QuizSessionStatusLobby
}

// IsActive returns true if the game is currently in progress
func (qs *QuizSession) IsActive() bool {
	return qs.Status == enums.QuizSessionStatusActive
}

// IsFinished returns true if the game has ended
func (qs *QuizSession) IsFinished() bool {
	return qs.Status == enums.QuizSessionStatusFinished
}

// IsValid validates domain-level rules for a QuizSession
func (qs *QuizSession) IsValid() error {
	if qs.QuizID == uuid.Nil {
		return ErrMissingQuizID
	}
	if qs.HostID == uuid.Nil {
		return ErrMissingHostID
	}
	if qs.PIN == "" {
		return ErrMissingSessionPIN
	}
	if !qs.Status.IsValid() {
		return ErrInvalidSessionStatus
	}
	return nil
}
