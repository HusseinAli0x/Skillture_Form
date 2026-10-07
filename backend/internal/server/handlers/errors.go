package handlers

import (
	"errors"
	"net/http"

	domainErrors "skillture/backend/internal/domain/errors"

	"github.com/gin-gonic/gin"
)

// respondError maps a domain error to an HTTP status and writes the response.
//
// Handlers previously each invented their own mapping: a missing form was a
// 404 in one place and a 500 in another, Delete returned 400 for forms and 500
// for quizzes, and GetByID reported a database outage as "not found". This is
// the single place that decision is made.
func respondError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domainErrors.ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "resource not found"})

	case errors.Is(err, domainErrors.ErrInvalidInput),
		errors.Is(err, domainErrors.ErrMissingRequiredField):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})

	case errors.Is(err, domainErrors.ErrFormClosed),
		errors.Is(err, domainErrors.ErrFormNotPublished),
		errors.Is(err, domainErrors.ErrQuizNotActive),
		errors.Is(err, domainErrors.ErrSessionNotActive),
		errors.Is(err, domainErrors.ErrSessionAlreadyStarted),
		errors.Is(err, domainErrors.ErrSessionFinished),
		errors.Is(err, domainErrors.ErrQuestionNotCurrent),
		errors.Is(err, domainErrors.ErrSessionFull):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})

	case errors.Is(err, domainErrors.ErrDuplicateResponse),
		errors.Is(err, domainErrors.ErrDuplicatePlayerName),
		errors.Is(err, domainErrors.ErrAlreadyAnswered):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})

	case errors.Is(err, domainErrors.ErrPlayerNotInSession):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})

	default:
		// Unrecognised errors are internal failures. The message is logged by
		// gin's recovery/logger middleware rather than returned, so database
		// and driver details do not reach the client.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
	}
}

// respondNotFoundIfNil writes a 404 and reports true when v is nil.
// Repositories signal "not found" by returning a nil entity with a nil error.
func respondNotFoundIfNil(c *gin.Context, isNil bool) bool {
	if isNil {
		c.JSON(http.StatusNotFound, gin.H{"error": "resource not found"})
		return true
	}
	return false
}
