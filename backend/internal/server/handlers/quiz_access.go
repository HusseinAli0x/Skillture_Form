package handlers

import (
	"errors"
	"net/http"

	"skillture/backend/internal/auth"
	"skillture/backend/internal/domain/entities"
	domainErrors "skillture/backend/internal/domain/errors"
	uc "skillture/backend/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// QuizAccess decides whether the caller may manage a quiz or a live session.
//
// Quizzes can be created by anyone, so "is authenticated" no longer implies
// "may touch this quiz". Every route that reads a quiz's answers or drives a
// session goes through here first:
//
//   - an admin may manage every quiz and session;
//   - a visitor may manage only quizzes carrying the hash of their own host
//     key, and the sessions of those quizzes.
//
// A caller who is not allowed gets the same 404 as for an id that does not
// exist, so ids cannot be probed to learn which games exist.
type QuizAccess struct {
	quizUC    uc.QuizUseCase
	sessionUC uc.QuizSessionUseCase
}

// NewQuizAccess creates a QuizAccess.
func NewQuizAccess(quizUC uc.QuizUseCase, sessionUC uc.QuizSessionUseCase) *QuizAccess {
	return &QuizAccess{quizUC: quizUC, sessionUC: sessionUC}
}

// Quiz authorizes the caller for the quiz. On failure it has already written
// the response and ok is false.
func (a *QuizAccess) Quiz(c *gin.Context, quizID uuid.UUID) (quiz *entities.Quiz, ok bool) {
	principal, authenticated := auth.PrincipalFromContext(c)
	if !authenticated {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing credentials"})
		return nil, false
	}

	quiz, err := a.quizUC.GetByID(c.Request.Context(), quizID)
	if err != nil {
		if errors.Is(err, domainErrors.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "resource not found"})
		} else {
			respondError(c, err)
		}
		return nil, false
	}
	if !principal.Owns(quiz.OwnerKeyHash) {
		c.JSON(http.StatusNotFound, gin.H{"error": "resource not found"})
		return nil, false
	}
	return quiz, true
}

// Session authorizes the caller for the session through the quiz it belongs to.
func (a *QuizAccess) Session(c *gin.Context, sessionID uuid.UUID) (session *entities.QuizSession, ok bool) {
	if _, authenticated := auth.PrincipalFromContext(c); !authenticated {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing credentials"})
		return nil, false
	}

	session, err := a.sessionUC.GetByID(c.Request.Context(), sessionID)
	if err != nil {
		if errors.Is(err, domainErrors.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "resource not found"})
		} else {
			respondError(c, err)
		}
		return nil, false
	}
	if _, ok := a.Quiz(c, session.QuizID); !ok {
		return nil, false
	}
	return session, true
}
