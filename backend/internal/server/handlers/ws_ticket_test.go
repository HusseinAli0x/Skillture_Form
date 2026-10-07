package handlers

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestWSTicketsSingleUse(t *testing.T) {
	w := NewWSTickets()
	session := uuid.New()

	ticket, err := w.Issue(session)
	if err != nil || ticket == "" {
		t.Fatalf("issue: %q, %v", ticket, err)
	}
	if !w.Redeem(ticket, session) {
		t.Fatal("a fresh ticket must redeem")
	}
	if w.Redeem(ticket, session) {
		t.Fatal("a ticket must work only once")
	}
}

func TestWSTicketsBoundToSession(t *testing.T) {
	w := NewWSTickets()
	ticket, _ := w.Issue(uuid.New())

	if w.Redeem(ticket, uuid.New()) {
		t.Fatal("a ticket must not open a different session")
	}
	// Using it on the wrong session burns it.
	if w.Redeem(ticket, uuid.New()) {
		t.Fatal("ticket must be spent")
	}
}

func TestWSTicketsExpire(t *testing.T) {
	w := NewWSTickets()
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	w.now = func() time.Time { return now }

	session := uuid.New()
	ticket, _ := w.Issue(session)

	now = now.Add(wsTicketTTL + time.Second)
	if w.Redeem(ticket, session) {
		t.Fatal("an expired ticket must not redeem")
	}
}

func TestWSTicketsUnknownAndUnique(t *testing.T) {
	w := NewWSTickets()
	if w.Redeem("nope", uuid.New()) {
		t.Fatal("unknown ticket redeemed")
	}
	session := uuid.New()
	a, _ := w.Issue(session)
	b, _ := w.Issue(session)
	if a == b {
		t.Fatal("tickets must be unique")
	}
}

func TestWSTicketsSweepExpired(t *testing.T) {
	w := NewWSTickets()
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	w.now = func() time.Time { return now }

	for i := 0; i < 50; i++ {
		_, _ = w.Issue(uuid.New())
	}
	now = now.Add(2 * wsTicketTTL)
	_, _ = w.Issue(uuid.New())

	w.mu.Lock()
	defer w.mu.Unlock()
	if len(w.tickets) != 1 {
		t.Fatalf("expired tickets should be swept on issue, %d remain", len(w.tickets))
	}
}

func TestWSTicketsCapOutstandingPerSession(t *testing.T) {
	w := NewWSTickets()
	session := uuid.New()

	var tickets []string
	for i := 0; i < maxTicketsPerSession; i++ {
		tk, err := w.Issue(session)
		if err != nil {
			t.Fatalf("ticket %d: %v", i+1, err)
		}
		tickets = append(tickets, tk)
	}
	if _, err := w.Issue(session); !errors.Is(err, ErrTooManyTickets) {
		t.Fatalf("over the allowance: %v, want ErrTooManyTickets", err)
	}
	// Another session is unaffected.
	if _, err := w.Issue(uuid.New()); err != nil {
		t.Fatalf("other session: %v", err)
	}
	// Redeeming frees an allowance.
	if !w.Redeem(tickets[0], session) {
		t.Fatal("redeem")
	}
	if _, err := w.Issue(session); err != nil {
		t.Fatalf("after redeeming one: %v", err)
	}
}

func TestWSTicketsAllowanceReturnsWhenTicketsExpire(t *testing.T) {
	w := NewWSTickets()
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	w.now = func() time.Time { return now }
	session := uuid.New()

	for i := 0; i < maxTicketsPerSession; i++ {
		if _, err := w.Issue(session); err != nil {
			t.Fatal(err)
		}
	}
	now = now.Add(wsTicketTTL + ticketSweepEvery + time.Second)
	if _, err := w.Issue(session); err != nil {
		t.Fatalf("expired tickets must stop counting: %v", err)
	}
}

func TestWSTicketsDoNotSweepOnEveryIssue(t *testing.T) {
	w := NewWSTickets()
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	w.now = func() time.Time { return now }

	_, _ = w.Issue(uuid.New()) // sweeps (first call)
	swept := w.lastSweep
	now = now.Add(time.Second)
	_, _ = w.Issue(uuid.New())
	if !w.lastSweep.Equal(swept) {
		t.Fatal("a second Issue within the interval should not sweep again")
	}
}
