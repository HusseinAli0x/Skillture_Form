package errors

import "errors"

var (
	// Common
	ErrNotFound     = errors.New("resource not found")
	ErrInvalidInput = errors.New("invalid input")

	// Form
	ErrFormClosed       = errors.New("form is closed")
	ErrFormNotPublished = errors.New("form is not published")

	// Response
	ErrDuplicateResponse    = errors.New("duplicate response")
	ErrMissingRequiredField = errors.New("missing required field")

	// Quiz
	ErrQuizNotActive         = errors.New("quiz is not active")
	ErrSessionNotActive      = errors.New("session is not in active state")
	ErrSessionAlreadyStarted = errors.New("session has already started")
	ErrSessionFinished       = errors.New("session is already finished")
	ErrDuplicatePlayerName   = errors.New("player name already taken in this session")
	ErrSessionFull           = errors.New("this game is full")
	ErrAlreadyAnswered       = errors.New("player has already answered this question")
	ErrPlayerNotInSession    = errors.New("player does not belong to this session")
	ErrQuestionNotCurrent    = errors.New("question is not the current active question")
)
