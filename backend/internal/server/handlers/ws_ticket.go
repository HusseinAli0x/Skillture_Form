package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// wsTicketTTL is how long a ticket can be redeemed after it is issued. The
// browser opens the socket immediately after asking for one.
const wsTicketTTL = 60 * time.Second

// maxTicketsPerSession bounds the unredeemed tickets one session may hold. A
// host needs one at a time (more only while reconnecting), so this is generous
// while stopping a script from filling the store.
const maxTicketsPerSession = 10

// ticketSweepEvery is how often expired tickets are purged. Doing it on every
// Issue made each call cost as much as the store was big.
const ticketSweepEvery = 10 * time.Second

// ErrTooManyTickets is returned when a session already holds its allowance.
var ErrTooManyTickets = errors.New("too many outstanding host tickets for this session")

// WSTickets hands out short-lived, single-use tickets for the host WebSocket.
//
// A browser cannot send an Authorization header on a WebSocket handshake, so
// the credential has to travel in the URL — and URLs end up in access logs.
// Putting an admin token or a host key there would write a long-lived secret
// into the logs. A ticket is worthless a minute later and after one use, so
// logging it is harmless.
type WSTickets struct {
	mu        sync.Mutex
	tickets   map[string]wsTicket
	bySession map[uuid.UUID]int
	lastSweep time.Time
	now       func() time.Time
}

type wsTicket struct {
	sessionID uuid.UUID
	expires   time.Time
}

// NewWSTickets creates an empty ticket store.
func NewWSTickets() *WSTickets {
	return &WSTickets{tickets: map[string]wsTicket{}, bySession: map[uuid.UUID]int{}, now: time.Now}
}

// Issue returns a new ticket valid for the session's host socket.
func (w *WSTickets) Issue(sessionID uuid.UUID) (string, error) {
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	ticket := base64.RawURLEncoding.EncodeToString(raw)

	w.mu.Lock()
	defer w.mu.Unlock()
	now := w.now()
	w.sweep(now)
	if w.bySession[sessionID] >= maxTicketsPerSession {
		return "", ErrTooManyTickets
	}
	w.tickets[ticket] = wsTicket{sessionID: sessionID, expires: now.Add(wsTicketTTL)}
	w.bySession[sessionID]++
	return ticket, nil
}

// sweep drops expired tickets, at most once per ticketSweepEvery. Callers hold w.mu.
func (w *WSTickets) sweep(now time.Time) {
	if now.Sub(w.lastSweep) < ticketSweepEvery {
		return
	}
	w.lastSweep = now
	for k, t := range w.tickets {
		if now.After(t.expires) {
			w.forget(k, t)
		}
	}
}

// forget removes a ticket and its share of the session's allowance.
func (w *WSTickets) forget(key string, t wsTicket) {
	delete(w.tickets, key)
	if w.bySession[t.sessionID]--; w.bySession[t.sessionID] <= 0 {
		delete(w.bySession, t.sessionID)
	}
}

// Redeem consumes a ticket. It succeeds once, for the session it was issued
// for, before it expires.
func (w *WSTickets) Redeem(ticket string, sessionID uuid.UUID) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	t, ok := w.tickets[ticket]
	if !ok {
		return false
	}
	w.forget(ticket, t) // single use, even when it turns out to be wrong
	return t.sessionID == sessionID && !w.now().After(t.expires)
}
