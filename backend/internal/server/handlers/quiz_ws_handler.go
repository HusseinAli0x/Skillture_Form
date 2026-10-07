package handlers

import (
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"skillture/backend/internal/config"
	domainErrors "skillture/backend/internal/domain/errors"
	"skillture/backend/internal/server/ws"
	uc "skillture/backend/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// QuizWSHandler handles WebSocket connections and real-time answer submission.
type QuizWSHandler struct {
	hub       *ws.Hub
	playerUC  uc.QuizPlayerUseCase
	answerUC  uc.QuizAnswerUseCase
	sessionUC uc.QuizSessionUseCase
	tickets   *WSTickets
	upgrader  websocket.Upgrader
}

// NewQuizWSHandler creates a new QuizWSHandler.
func NewQuizWSHandler(
	hub *ws.Hub,
	playerUC uc.QuizPlayerUseCase,
	answerUC uc.QuizAnswerUseCase,
	sessionUC uc.QuizSessionUseCase,
	tickets *WSTickets,
	corsCfg config.CORSConfig,
) *QuizWSHandler {
	return &QuizWSHandler{
		hub:       hub,
		playerUC:  playerUC,
		answerUC:  answerUC,
		sessionUC: sessionUC,
		tickets:   tickets,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			// A WebSocket handshake is not subject to the same-origin policy,
			// so `return true` let any page on the internet open a socket
			// against a session. Restrict to the configured origins.
			CheckOrigin: originChecker(corsCfg.AllowedOrigins),
		},
	}
}

// originChecker builds a CheckOrigin function from the CORS allow-list.
// A request with no Origin header is not browser-initiated and is allowed.
func originChecker(allowed []string) func(*http.Request) bool {
	allowAll := slices.Contains(allowed, "*")
	return func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		if allowAll || slices.Contains(allowed, origin) {
			return true
		}
		// A page served from the same host it connects back to is not
		// cross-site, whatever address it was opened on (a LAN IP in dev, the
		// real domain behind Caddy). Rejecting it left every game without
		// real-time updates unless that exact origin had been listed by hand.
		u, err := url.Parse(origin)
		return err == nil && strings.EqualFold(u.Host, r.Host)
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

	// The host socket carries every game event, including the host's view of
	// the session, so it must be authenticated. Browsers cannot set headers on
	// a WebSocket handshake, so the caller first asks for a one-minute,
	// single-use ticket over the authenticated REST API (QuizSessionHandler.
	// WSTicket) and presents it here. A ticket is worthless once used, so it is
	// safe for it to appear in access logs, unlike an access token or host key.
	if !h.tickets.Redeem(c.Query("ticket"), sessionID) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired ticket"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return // upgrader writes the HTTP error itself
	}

	h.hub.RegisterClient(conn, sessionID, uuid.Nil, "", ws.RoleHost)
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

	// The player ID is client-supplied (and visible to everyone in the room).
	// Without these checks any UUID could be presented, letting a caller attach
	// to a session they never joined or impersonate another player.
	player, err := h.playerUC.GetPlayer(c.Request.Context(), playerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify player"})
		return
	}
	if player == nil || player.SessionID != sessionID {
		c.JSON(http.StatusForbidden, gin.H{"error": "player does not belong to this session"})
		return
	}
	if !player.VerifySecret(c.Query("secret")) {
		c.JSON(http.StatusForbidden, gin.H{"error": "player credentials are invalid"})
		return
	}

	// Fetch the session before upgrading — after the upgrade the connection is
	// no longer an HTTP response and errors cannot be reported as status codes.
	session, err := h.sessionUC.GetByID(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load session"})
		return
	}
	if session == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := h.hub.RegisterClient(conn, sessionID, playerID, player.Name, ws.RolePlayer)

	// Give the player the current state, in case they joined mid-game or are
	// reconnecting after a dropped connection. The live question (without its
	// answer) is included so they land on it rather than waiting for the next.
	snapshot := gin.H{
		"status":              session.Status,
		"current_question_id": session.CurrentQuestionID,
		"players":             h.hub.PlayerNames(sessionID),
	}
	if current, err := h.sessionUC.CurrentQuestion(c.Request.Context(), session); err == nil && current != nil {
		snapshot["question"] = current.PublicView()
	}
	client.Send(ws.Message{Type: ws.MsgTypeLobbySnapshot, Payload: snapshot})

	// Broadcast to the room that a new player joined. The name is included so
	// the host lobby can render it; previously only the UUID was sent and the
	// host displayed every joiner as "New Player".
	h.hub.BroadcastExcept(sessionID, ws.Message{
		Type: ws.MsgTypePlayerJoined,
		Payload: gin.H{
			"player_id":  playerID,
			"name":       player.Name,
			"avatar_id":  player.AvatarID,
			"avatar_url": player.AvatarURL,
		},
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
		// Secret proves the caller is that player: the player id is visible to
		// everyone in the room, the secret only to the player it was given to.
		Secret string `json:"secret"`
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

	if !h.playerIsCaller(c, playerID, req.Secret) {
		c.JSON(http.StatusForbidden, gin.H{"error": "player credentials are invalid"})
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
		switch {
		case errors.Is(err, domainErrors.ErrAlreadyAnswered):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		case errors.Is(err, domainErrors.ErrPlayerNotInSession):
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		case errors.Is(err, domainErrors.ErrSessionNotActive), errors.Is(err, domainErrors.ErrQuestionNotCurrent):
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// A repeat submission changes nothing, so it tells the room nothing.
	if !result.AlreadyAnswered {
		// Tell the room an answer landed. The host uses this to increment its
		// counter; player_id lets it de-duplicate rather than counting blind.
		h.hub.Broadcast(sessionID, ws.Message{
			Type:    ws.MsgTypeAnswerResult,
			Payload: gin.H{"player_id": playerID},
		})

		// The usecase already read the fresh leaderboard to build this result;
		// broadcasting it here means the host does not need a follow-up request.
		h.hub.Broadcast(sessionID, ws.Message{
			Type:    ws.MsgTypeLeaderboard,
			Payload: result.Leaderboard,
		})
	}

	// Return scoring result to the answering player via REST
	c.JSON(http.StatusOK, gin.H{
		"is_correct":    result.IsCorrect,
		"score_awarded": result.ScoreAwarded,
		"streak":        result.Streak,
		"streak_bonus":  result.StreakBonus,
		"total_score":   result.TotalScore,
		"rank":          result.Rank,
		"players":       len(result.Leaderboard),
		// True when this repeated an earlier submission (a retry or a double
		// tap); the figures above are the original result.
		"already_answered": result.AlreadyAnswered,
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
		// AvatarID indexes the frontend's fixed 7-entry glyph list (see
		// frontend/src/lib/avatars.ts); AvatarURL is a data: URL for an
		// uploaded photo. Both optional — the client may send neither, either,
		// but not both meaningfully (a glyph pick omits avatar_url and vice
		// versa).
		AvatarID  *int16  `json:"avatar_id" binding:"omitempty,min=0,max=6"`
		AvatarURL *string `json:"avatar_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Name and avatar are validated and bounded by the use case.

	player, err := h.playerUC.JoinSession(c.Request.Context(), sessionID, req.Name, req.AvatarID, req.AvatarURL)
	if err != nil {
		// There is no ErrSessionNotInLobby case here any more: joining a game
		// in progress is allowed, so that branch was unreachable. respondError
		// maps ErrSessionFinished to 422 and ErrDuplicatePlayerName to 409.
		respondError(c, err)
		return
	}

	// Return the player record — the client uses player.ID to open the WS connection
	c.JSON(http.StatusCreated, player)
}

// playerIsCaller reports whether the presented secret belongs to the player.
// An unknown player passes through (false is only for a wrong secret), so the
// use case keeps reporting "player not in session" for that case as before.
func (h *QuizWSHandler) playerIsCaller(c *gin.Context, playerID uuid.UUID, secret string) bool {
	player, err := h.playerUC.GetPlayer(c.Request.Context(), playerID)
	if err != nil || player == nil {
		return true
	}
	return player.VerifySecret(secret)
}
