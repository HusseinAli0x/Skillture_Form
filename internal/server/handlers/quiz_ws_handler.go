package handlers

import (
	"net/http"

	domainErrors "Skillture_Form/internal/domain/errors"
	"Skillture_Form/internal/server/ws"
	uc "Skillture_Form/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins in dev. Restrict in production via CheckOrigin.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// QuizWSHandler handles WebSocket connections and real-time answer submission.
type QuizWSHandler struct {
	hub       *ws.Hub
	playerUC  uc.QuizPlayerUseCase
	answerUC  uc.QuizAnswerUseCase
	sessionUC uc.QuizSessionUseCase
}

// NewQuizWSHandler creates a new QuizWSHandler.
func NewQuizWSHandler(
	hub *ws.Hub,
	playerUC uc.QuizPlayerUseCase,
	answerUC uc.QuizAnswerUseCase,
	sessionUC uc.QuizSessionUseCase,
) *QuizWSHandler {
	return &QuizWSHandler{
		hub:       hub,
		playerUC:  playerUC,
		answerUC:  answerUC,
		sessionUC: sessionUC,
	}
}

// GET /ws/sessions/:id/host
// Host connects to the WebSocket room for a session.
// The host receives all lobby and game events but cannot be evicted by the
// "already started" guard (they opened the session).
func (h *QuizWSHandler) ConnectHost(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return // upgrader writes the HTTP error itself
	}

	h.hub.RegisterClient(conn, sessionID, uuid.Nil, ws.RoleHost)
}

// GET /ws/sessions/:id/join?player_id=<uuid>
// Player connects after calling the REST join endpoint.
// On connect, broadcasts player_joined to the room and sends a lobby_snapshot
// to the newly connected player showing who else is already in the lobby.
func (h *QuizWSHandler) ConnectPlayer(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	playerIDStr := c.Query("player_id")
	playerID, err := uuid.Parse(playerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid player_id query param"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := h.hub.RegisterClient(conn, sessionID, playerID, ws.RolePlayer)

	// Broadcast to the room that a new player joined
	h.hub.BroadcastExcept(sessionID, ws.Message{
		Type:    ws.MsgTypePlayerJoined,
		Payload: gin.H{"player_id": playerID},
	}, client)
}

// POST /api/v1/sessions/:id/answer
// Player submits an answer for the currently live question.
// On success, broadcasts the updated leaderboard to all room clients.
func (h *QuizWSHandler) SubmitAnswer(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	var req struct {
		PlayerID    string         `json:"player_id"    binding:"required"`
		QuestionID  string         `json:"question_id"  binding:"required"`
		Answer      map[string]any `json:"answer"       binding:"required"`
		TimeTakenMs int            `json:"time_taken_ms"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	playerID, err := uuid.Parse(req.PlayerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid player_id"})
		return
	}
	questionID, err := uuid.Parse(req.QuestionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid question_id"})
		return
	}

	result, err := h.answerUC.SubmitAnswer(c.Request.Context(), uc.SubmitAnswerInput{
		PlayerID:    playerID,
		SessionID:   sessionID,
		QuestionID:  questionID,
		Answer:      req.Answer,
		TimeTakenMs: req.TimeTakenMs,
	})
	if err != nil {
		switch err {
		case domainErrors.ErrAlreadyAnswered:
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		case domainErrors.ErrSessionNotActive, domainErrors.ErrQuestionNotCurrent:
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Broadcast updated leaderboard to the entire room
	h.hub.Broadcast(sessionID, ws.Message{
		Type:    ws.MsgTypeLeaderboard,
		Payload: result.Leaderboard,
	})

	// Return scoring result to the answering player via REST
	c.JSON(http.StatusOK, gin.H{
		"is_correct":    result.IsCorrect,
		"score_awarded": result.ScoreAwarded,
	})
}

// POST /api/v1/sessions/:id/players
// Player joins a lobby session via REST, then connects to WebSocket.
func (h *QuizWSHandler) JoinSession(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	player, err := h.playerUC.JoinSession(c.Request.Context(), sessionID, req.Name)
	if err != nil {
		switch err {
		case domainErrors.ErrSessionNotInLobby:
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		case domainErrors.ErrDuplicatePlayerName:
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Return the player record — the client uses player.ID to open the WS connection
	c.JSON(http.StatusCreated, player)
}
