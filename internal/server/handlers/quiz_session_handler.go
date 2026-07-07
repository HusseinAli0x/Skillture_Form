package handlers

import (
	"net/http"

	uc "Skillture_Form/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// QuizSessionHandler handles HTTP requests for live game session management.
// The host drives all state transitions (start, advance, finish) via REST;
// real-time events are broadcast to players over WebSocket by the hub.
type QuizSessionHandler struct {
	sessionUC uc.QuizSessionUseCase
	playerUC  uc.QuizPlayerUseCase
}

// NewQuizSessionHandler creates a new QuizSessionHandler.
func NewQuizSessionHandler(
	sessionUC uc.QuizSessionUseCase,
	playerUC uc.QuizPlayerUseCase,
) *QuizSessionHandler {
	return &QuizSessionHandler{
		sessionUC: sessionUC,
		playerUC:  playerUC,
	}
}

// POST /api/v1/quizzes/:id/sessions
// Host creates a new lobby session for a quiz. Returns the session with the PIN.
func (h *QuizSessionHandler) CreateSession(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}

	// host_id is optional — use a sentinel UUID if not provided
	var req struct {
		HostID string `json:"host_id"`
	}
	_ = c.ShouldBindJSON(&req) // ignore binding error; body may be empty

	hostID := uuid.Nil
	if req.HostID != "" {
		if hostID, err = uuid.Parse(req.HostID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid host_id"})
			return
		}
	}

	session, err := h.sessionUC.CreateSession(c.Request.Context(), quizID, hostID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, session)
}

// GET /api/v1/sessions/:id
// Returns the current state of a session (status, current_question_id, etc.)
func (h *QuizSessionHandler) GetSession(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}
	session, err := h.sessionUC.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, session)
}

// GET /api/v1/sessions/pin/:pin
// Players use this to look up a session by the join PIN before connecting via WebSocket.
func (h *QuizSessionHandler) GetByPIN(c *gin.Context) {
	pin := c.Param("pin")
	session, err := h.sessionUC.GetByPIN(c.Request.Context(), pin)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, session)
}

// PATCH /api/v1/sessions/:id/start
// Host starts the game. Transitions lobby → active.
func (h *QuizSessionHandler) StartSession(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}
	if err := h.sessionUC.StartSession(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "started"})
}

// PATCH /api/v1/sessions/:id/advance
// Host advances to a specific question. Returns the question so the caller
// can read time_limit_sec and broadcast it over WebSocket.
func (h *QuizSessionHandler) AdvanceQuestion(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	var req struct {
		QuestionID string `json:"question_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	questionID, err := uuid.Parse(req.QuestionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid question_id"})
		return
	}

	question, err := h.sessionUC.AdvanceQuestion(c.Request.Context(), sessionID, questionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, question)
}

// PATCH /api/v1/sessions/:id/finish
// Host ends the game. Transitions active → finished.
func (h *QuizSessionHandler) FinishSession(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}
	if err := h.sessionUC.FinishSession(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "finished"})
}

// GET /api/v1/sessions/:id/leaderboard
// Returns the current leaderboard (players sorted by score DESC).
func (h *QuizSessionHandler) GetLeaderboard(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}
	leaderboard, err := h.playerUC.GetLeaderboard(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, leaderboard)
}
