// Package ws implements the WebSocket hub for real-time quiz game sessions.
// Architecture:
//   - Hub: manages all active sessions; one Hub per application instance.
//   - Room: one per live session; holds all connected clients.
//   - Client: one per WebSocket connection (host or player).
//
// Message flow:
//   Client --(write)--> Client.send channel --> Hub.broadcast --> all Room clients
package ws

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// ---- Wire sizes & timeouts ----

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// ---- Message types (server → client) ----

const (
	MsgTypePlayerJoined  = "player_joined"   // broadcast when a new player enters lobby
	MsgTypeGameStarted   = "game_started"    // broadcast when host starts the game
	MsgTypeQuestion      = "question"        // broadcast when host advances to next question
	MsgTypeAnswerResult  = "answer_result"   // sent to the answering player only
	MsgTypeLeaderboard   = "leaderboard"     // broadcast after each question
	MsgTypeGameFinished  = "game_finished"   // broadcast when all questions done
	MsgTypeError         = "error"           // sent to a single client on bad input
	MsgTypeLobbySnapshot = "lobby_snapshot"  // sent to a newly joined player: current lobby state
)

// Message is the envelope for every WebSocket frame sent by the server.
type Message struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

// ---- Client ----

// ClientRole distinguishes the host from regular players in a room.
type ClientRole string

const (
	RoleHost   ClientRole = "host"
	RolePlayer ClientRole = "player"
)

// Client represents a single active WebSocket connection.
type Client struct {
	hub       *Hub
	conn      *websocket.Conn
	send      chan []byte   // outbound message buffer
	sessionID uuid.UUID     // which room this client belongs to
	playerID  uuid.UUID     // uuid.Nil for host clients
	role      ClientRole
}

// writePump pumps outbound messages from the send channel to the WebSocket.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads inbound frames and routes them to the hub.
// The hub currently ignores inbound frames from clients (all game events are
// driven by HTTP API calls from the host), but the read loop keeps the
// connection alive and detects disconnections.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws: client disconnected unexpectedly: %v", err)
			}
			break
		}
	}
}

// Send encodes a Message and queues it on the client's send channel.
// Non-blocking: drops the message if the buffer is full (slow client).
func (c *Client) Send(msg Message) {
	b, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws: marshal error: %v", err)
		return
	}
	select {
	case c.send <- b:
	default:
		log.Printf("ws: send buffer full for client in session %s — dropping message", c.sessionID)
	}
}

// ---- Room ----

// Room holds all connected clients for a single quiz session.
type Room struct {
	sessionID uuid.UUID
	clients   map[*Client]struct{}
	mu        sync.RWMutex
}

func newRoom(sessionID uuid.UUID) *Room {
	return &Room{
		sessionID: sessionID,
		clients:   make(map[*Client]struct{}),
	}
}

// add registers a client in this room.
func (r *Room) add(c *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[c] = struct{}{}
}

// remove deregisters a client from this room.
func (r *Room) remove(c *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.clients, c)
}

// broadcast sends a message to every client in the room.
func (r *Room) broadcast(msg Message) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for c := range r.clients {
		c.Send(msg)
	}
}

// broadcastExcept sends a message to every client except the excluded one.
func (r *Room) broadcastExcept(msg Message, exclude *Client) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for c := range r.clients {
		if c != exclude {
			c.Send(msg)
		}
	}
}

// PlayerNames returns the nickname list of all player-role clients.
// Used to send a lobby snapshot to newly joining players.
func (r *Room) PlayerNames() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var names []string
	for c := range r.clients {
		if c.role == RolePlayer {
			names = append(names, string(c.playerID.String()))
		}
	}
	return names
}

// isEmpty reports whether the room has no connected clients.
func (r *Room) isEmpty() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients) == 0
}

// ---- Hub ----

// Hub is the central registry of all active quiz session rooms.
// One Hub runs per application instance.
type Hub struct {
	rooms      map[uuid.UUID]*Room
	mu         sync.RWMutex
	register   chan *Client
	unregister chan *Client
}

// NewHub creates and returns a new Hub.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[uuid.UUID]*Room),
		register:   make(chan *Client, 256),
		unregister: make(chan *Client, 256),
	}
}

// Run starts the Hub's event loop. Call in a dedicated goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			room := h.getOrCreateRoom(client.sessionID)
			room.add(client)

		case client := <-h.unregister:
			h.mu.RLock()
			room, exists := h.rooms[client.sessionID]
			h.mu.RUnlock()
			if exists {
				room.remove(client)
				close(client.send)
				// Clean up empty rooms
				if room.isEmpty() {
					h.mu.Lock()
					delete(h.rooms, client.sessionID)
					h.mu.Unlock()
				}
			}
		}
	}
}

// getOrCreateRoom returns an existing room or creates a new one.
func (h *Hub) getOrCreateRoom(sessionID uuid.UUID) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	if room, ok := h.rooms[sessionID]; ok {
		return room
	}
	room := newRoom(sessionID)
	h.rooms[sessionID] = room
	return room
}

// RegisterClient connects a WebSocket client to the hub and starts its pumps.
// Call from an HTTP upgrade handler.
func (h *Hub) RegisterClient(conn *websocket.Conn, sessionID, playerID uuid.UUID, role ClientRole) *Client {
	c := &Client{
		hub:       h,
		conn:      conn,
		send:      make(chan []byte, 64),
		sessionID: sessionID,
		playerID:  playerID,
		role:      role,
	}
	h.register <- c
	go c.writePump()
	go c.readPump()
	return c
}

// Broadcast sends a message to every client in a session room.
func (h *Hub) Broadcast(sessionID uuid.UUID, msg Message) {
	h.mu.RLock()
	room, ok := h.rooms[sessionID]
	h.mu.RUnlock()
	if ok {
		room.broadcast(msg)
	}
}

// BroadcastExcept sends a message to every client in a room except one.
func (h *Hub) BroadcastExcept(sessionID uuid.UUID, msg Message, exclude *Client) {
	h.mu.RLock()
	room, ok := h.rooms[sessionID]
	h.mu.RUnlock()
	if ok {
		room.broadcastExcept(msg, exclude)
	}
}

// RoomExists reports whether a room is currently active.
func (h *Hub) RoomExists(sessionID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.rooms[sessionID]
	return ok
}
