package handlers_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"skillture/backend/internal/auth"
	"skillture/backend/internal/config"
	"skillture/backend/internal/database"
	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/repository/postgres"
	"skillture/backend/internal/server"
	"skillture/backend/internal/server/handlers"
	"skillture/backend/internal/server/ws"
	"skillture/backend/internal/usecase/quiz"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

// These tests drive the real router, use cases and repositories against
// Postgres to prove the property that opening the quiz builder to everyone
// depends on: a visitor can use their own games and nobody else's.
//
//	TEST_DATABASE_URL='postgres://user:pass@localhost:5432/skillture_test' go test ./internal/server/handlers/
//
// They skip when TEST_DATABASE_URL is not set.

var (
	accessPool     *pgxpool.Pool
	accessPoolOnce sync.Once
)

func integrationPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping quiz access integration tests")
	}
	accessPoolOnce.Do(func() {
		ctx := context.Background()
		pool, err := pgxpool.New(ctx, url)
		if err != nil {
			t.Fatalf("connect: %v", err)
		}
		if err := database.Migrate(ctx, pool); err != nil {
			t.Fatalf("migrate: %v", err)
		}
		accessPool = pool
	})
	if accessPool == nil {
		t.Fatal("test pool unavailable")
	}
	return accessPool
}

// harness is a fully wired API plus the identities the tests act as.
type harness struct {
	t      *testing.T
	pool   *pgxpool.Pool
	router *gin.Engine
	quizUC interface {
		Create(ctx context.Context, q *entities.Quiz) error
	}
	adminToken string
	adminID    uuid.UUID
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	pool := integrationPool(t)
	gin.SetMode(gin.TestMode)

	base := postgres.NewBaseRepository(pool, 30*time.Second)
	quizRepo := postgres.NewQuizRepository(base)
	questionRepo := postgres.NewQuizQuestionRepository(base)
	sessionRepo := postgres.NewQuizSessionRepository(base)
	playerRepo := postgres.NewQuizPlayerRepository(base)
	answerRepo := postgres.NewQuizPlayerAnswerRepository(base)

	quizUC := quiz.NewQuizUseCase(quizRepo)
	questionUC := quiz.NewQuizQuestionUseCase(quizRepo, questionRepo)
	sessionUC := quiz.NewQuizSessionUseCase(quizRepo, questionRepo, sessionRepo)
	playerUC := quiz.NewQuizPlayerUseCase(sessionRepo, playerRepo)
	answerUC := quiz.NewQuizAnswerUseCase(sessionRepo, questionRepo, playerRepo, answerRepo)

	hub := ws.NewHub()
	go hub.Run()

	access := handlers.NewQuizAccess(quizUC, sessionUC)
	tickets := handlers.NewWSTickets()
	tokens := auth.NewTokenIssuer(config.JWTConfig{Secret: strings.Repeat("s", 40), Issuer: "test", AccessExpireMin: 30})

	r := gin.New()
	server.SetupRoutes(r, tokens,
		(*handlers.AdminHandler)(nil),
		handlers.NewQuizHandler(quizUC, questionUC, access),
		handlers.NewQuizSessionHandler(sessionUC, playerUC, answerUC, hub, access, tickets),
		handlers.NewQuizWSHandler(hub, playerUC, answerUC, sessionUC, tickets, config.CORSConfig{}),
		(*handlers.FormHandler)(nil), (*handlers.FormFieldHandler)(nil), (*handlers.ResponseHandler)(nil),
		(*handlers.HomepageHandler)(nil), (*handlers.GeminiHandler)(nil), (*handlers.WorkshopHandler)(nil),
		(*handlers.ContactHandler)(nil), (*handlers.TeamHandler)(nil), (*handlers.SiteHandler)(nil),
		config.SecurityConfig{MaxLoginAttempts: 5, LockoutDurationMin: 15},
	)

	// host_id is a foreign key to admins, so the admin must really exist.
	adminID := uuid.New()
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO admins (id, username, hashed_password) VALUES ($1, $2, 'x')`,
		adminID, "access-test-"+adminID.String()[:8]); err != nil {
		t.Fatalf("insert admin: %v", err)
	}
	token, _, err := tokens.Issue(adminID, "access-test")
	if err != nil {
		t.Fatal(err)
	}

	h := &harness{t: t, pool: pool, router: r, quizUC: quizUC, adminToken: token, adminID: adminID}
	t.Cleanup(func() {
		ctx := context.Background()
		_, _ = pool.Exec(ctx, `DELETE FROM quizzes WHERE title->>'en' LIKE 'ACCESS-TEST%'`)
		_, _ = pool.Exec(ctx, `DELETE FROM admins WHERE id = $1`, adminID)
	})
	return h
}

func newHostKey(t *testing.T) string {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatal(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// as sends a request with the given credentials: "" anonymous, "admin", or a host key.
func (h *harness) as(who, method, path string, body any) *httptest.ResponseRecorder {
	h.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			h.t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	switch who {
	case "":
	case "admin":
		req.Header.Set("Authorization", "Bearer "+h.adminToken)
	default:
		req.Header.Set(auth.HostKeyHeader, who)
	}
	w := httptest.NewRecorder()
	h.router.ServeHTTP(w, req)
	return w
}

func decode(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatalf("not a JSON object: %q", w.Body.String())
	}
	return m
}

func sampleQuestions() map[string]any {
	return map[string]any{"questions": []any{
		map[string]any{
			"question": map[string]any{"en": "2 + 2?"}, "type": "mcq", "time_limit_sec": 10, "points": 1000,
			"options":        map[string]any{"a": map[string]any{"value": "3"}, "b": map[string]any{"value": "4"}},
			"correct_answer": map[string]any{"value": "4"},
		},
	}}
}

// createReadyQuiz makes an active quiz with one question owned by `who`.
func (h *harness) createReadyQuiz(who, title string) string {
	h.t.Helper()
	w := h.as(who, http.MethodPost, "/api/v1/quizzes", map[string]any{"title": map[string]any{"en": title}})
	if w.Code != http.StatusCreated {
		h.t.Fatalf("create quiz: %d %s", w.Code, w.Body.String())
	}
	id := decode(h.t, w)["id"].(string)
	if w := h.as(who, http.MethodPut, "/api/v1/quizzes/"+id+"/questions", sampleQuestions()); w.Code != http.StatusOK {
		h.t.Fatalf("save questions: %d %s", w.Code, w.Body.String())
	}
	if w := h.as(who, http.MethodPatch, "/api/v1/quizzes/"+id+"/activate", nil); w.Code != http.StatusOK {
		h.t.Fatalf("activate: %d %s", w.Code, w.Body.String())
	}
	return id
}

func TestVisitorsOnlyReachTheirOwnGames(t *testing.T) {
	h := newHarness(t)
	alice, bob := newHostKey(t), newHostKey(t)

	id := h.createReadyQuiz(alice, "ACCESS-TEST isolation")

	// The creator's response must not leak the ownership hash.
	w := h.as(alice, http.MethodGet, "/api/v1/quizzes/"+id, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("owner GET: %d", w.Code)
	}
	if body := w.Body.String(); strings.Contains(body, "owner") || !strings.Contains(body, `"by_visitor":true`) {
		t.Fatalf("quiz JSON: %s", body)
	}

	// Lists: each visitor sees only their own; an admin sees everything.
	listIDs := func(who string) []string {
		var rows []map[string]any
		if err := json.Unmarshal(h.as(who, http.MethodGet, "/api/v1/quizzes", nil).Body.Bytes(), &rows); err != nil {
			t.Fatal(err)
		}
		ids := []string{}
		for _, r := range rows {
			ids = append(ids, r["id"].(string))
		}
		return ids
	}
	if got := listIDs(alice); len(got) != 1 || got[0] != id {
		t.Fatalf("alice sees %v", got)
	}
	if got := listIDs(bob); len(got) != 0 {
		t.Fatalf("bob sees %v, want nothing", got)
	}
	foundByAdmin := false
	for _, got := range listIDs("admin") {
		foundByAdmin = foundByAdmin || got == id
	}
	if !foundByAdmin {
		t.Fatal("admin should see every quiz")
	}

	// Bob cannot touch Alice's quiz in any way — and learns nothing: it is a 404.
	q := "/api/v1/quizzes/" + id
	for _, probe := range []struct{ method, path string }{
		{http.MethodGet, q},
		{http.MethodPut, q},
		{http.MethodDelete, q},
		{http.MethodPatch, q + "/activate"},
		{http.MethodPatch, q + "/archive"},
		{http.MethodGet, q + "/questions"},
		{http.MethodPut, q + "/questions"},
		{http.MethodPost, q + "/questions"},
		{http.MethodPost, q + "/sessions"},
	} {
		var body any
		switch probe.method {
		case http.MethodPut, http.MethodPost:
			body = map[string]any{"title": map[string]any{"en": "hijack"}, "questions": []any{}}
		}
		if w := h.as(bob, probe.method, probe.path, body); w.Code != http.StatusNotFound {
			t.Errorf("bob %s %s: %d, want 404", probe.method, probe.path, w.Code)
		}
		if w := h.as("", probe.method, probe.path, body); w.Code != http.StatusUnauthorized {
			t.Errorf("anonymous %s %s: %d, want 401", probe.method, probe.path, w.Code)
		}
	}

	// Alice hosts. The public session lookup never reveals who hosts.
	sw := h.as(alice, http.MethodPost, q+"/sessions", nil)
	if sw.Code != http.StatusCreated {
		t.Fatalf("alice hosts: %d %s", sw.Code, sw.Body.String())
	}
	session := decode(t, sw)
	sid, pin := session["id"].(string), session["pin"].(string)
	if _, leaked := session["host_id"]; leaked {
		t.Fatal("session JSON must not expose host_id")
	}

	pub := h.as("", http.MethodGet, "/api/v1/sessions/pin/"+pin, nil)
	if pub.Code != http.StatusOK || strings.Contains(pub.Body.String(), "host_id") {
		t.Fatalf("public PIN lookup: %d %s", pub.Code, pub.Body.String())
	}

	// Bob cannot drive Alice's session.
	for _, probe := range []struct{ method, path string }{
		{http.MethodPatch, "/api/v1/sessions/" + sid + "/start"},
		{http.MethodPatch, "/api/v1/sessions/" + sid + "/advance"},
		{http.MethodPatch, "/api/v1/sessions/" + sid + "/finish"},
		{http.MethodPost, "/api/v1/sessions/" + sid + "/show_results"},
		{http.MethodPost, "/api/v1/sessions/" + sid + "/ws-ticket"},
	} {
		if w := h.as(bob, probe.method, probe.path, map[string]any{"question_id": uuid.NewString()}); w.Code != http.StatusNotFound {
			t.Errorf("bob %s %s: %d, want 404", probe.method, probe.path, w.Code)
		}
	}

	// Alice can; so can an admin.
	if w := h.as(alice, http.MethodPatch, "/api/v1/sessions/"+sid+"/start", nil); w.Code != http.StatusOK {
		t.Fatalf("alice start: %d %s", w.Code, w.Body.String())
	}
	if w := h.as("admin", http.MethodGet, q+"/questions", nil); w.Code != http.StatusOK {
		t.Fatalf("admin reads questions: %d", w.Code)
	}
	if w := h.as("admin", http.MethodPost, q+"/sessions", nil); w.Code != http.StatusCreated {
		t.Fatalf("admin hosts a visitor's quiz: %d %s", w.Code, w.Body.String())
	}

	// Deleting is the owner's call.
	if w := h.as(bob, http.MethodDelete, q, nil); w.Code != http.StatusNotFound {
		t.Fatalf("bob delete: %d", w.Code)
	}
	if w := h.as(alice, http.MethodDelete, q, nil); w.Code != http.StatusNoContent {
		t.Fatalf("alice delete: %d", w.Code)
	}
	if w := h.as(alice, http.MethodGet, q, nil); w.Code != http.StatusNotFound {
		t.Fatalf("after delete: %d", w.Code)
	}
}

func TestAdminQuizzesAreNotReachableByVisitors(t *testing.T) {
	h := newHarness(t)
	id := h.createReadyQuiz("admin", "ACCESS-TEST admin-owned")

	visitor := newHostKey(t)
	if w := h.as(visitor, http.MethodGet, "/api/v1/quizzes/"+id+"/questions", nil); w.Code != http.StatusNotFound {
		t.Fatalf("visitor reading an admin quiz's answers: %d, want 404", w.Code)
	}
	if w := h.as(visitor, http.MethodPost, "/api/v1/quizzes/"+id+"/sessions", nil); w.Code != http.StatusNotFound {
		t.Fatalf("visitor hosting an admin quiz: %d, want 404", w.Code)
	}
	var rows []map[string]any
	_ = json.Unmarshal(h.as(visitor, http.MethodGet, "/api/v1/quizzes", nil).Body.Bytes(), &rows)
	if len(rows) != 0 {
		t.Fatalf("visitor list leaks %d admin quizzes", len(rows))
	}

	// The admin quiz is flagged as not coming from a visitor.
	got := decode(t, h.as("admin", http.MethodGet, "/api/v1/quizzes/"+id, nil))
	if got["by_visitor"] != false {
		t.Fatalf("by_visitor = %v", got["by_visitor"])
	}
}

func TestHostSocketNeedsAOneTimeTicketForTheSameSession(t *testing.T) {
	h := newHarness(t)
	alice := newHostKey(t)
	id := h.createReadyQuiz(alice, "ACCESS-TEST ws")
	s1 := decode(t, h.as(alice, http.MethodPost, "/api/v1/quizzes/"+id+"/sessions", nil))["id"].(string)

	srv := httptest.NewServer(h.router)
	defer srv.Close()
	wsBase := "ws" + strings.TrimPrefix(srv.URL, "http")

	// dial opens the host socket with the given query and reports the HTTP
	// status of the handshake (101 when it was accepted).
	dial := func(session, query string) (*websocket.Conn, int) {
		t.Helper()
		conn, resp, err := websocket.DefaultDialer.Dial(wsBase+"/ws/sessions/"+session+"/host?"+query, nil)
		status := 0
		if resp != nil {
			status = resp.StatusCode
			_ = resp.Body.Close()
		}
		if err != nil && status == 0 {
			t.Fatalf("dial failed without a response: %v", err)
		}
		return conn, status
	}
	issue := func(session string) string {
		w := h.as(alice, http.MethodPost, "/api/v1/sessions/"+session+"/ws-ticket", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("ticket: %d %s", w.Code, w.Body.String())
		}
		return decode(t, w)["ticket"].(string)
	}

	// The old way — a bearer token in the URL — is gone.
	if _, status := dial(s1, "token="+h.adminToken); status != http.StatusUnauthorized {
		t.Fatalf("token in URL: %d, want 401", status)
	}

	ticket := issue(s1)
	conn, status := dial(s1, "ticket="+ticket)
	if status != http.StatusSwitchingProtocols || conn == nil {
		t.Fatalf("first use of a fresh ticket: %d", status)
	}
	_ = conn.Close()

	if _, status := dial(s1, "ticket="+ticket); status != http.StatusUnauthorized {
		t.Fatalf("reusing a ticket: %d, want 401", status)
	}

	// A ticket for one game cannot open another.
	id2 := h.createReadyQuiz(alice, "ACCESS-TEST ws two")
	s2 := decode(t, h.as(alice, http.MethodPost, "/api/v1/quizzes/"+id2+"/sessions", nil))["id"].(string)
	if _, status := dial(s2, "ticket="+issue(s1)); status != http.StatusUnauthorized {
		t.Fatalf("ticket for another session: %d, want 401", status)
	}
}

func TestVisitorQuizQuotaAndLimits(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	visitor := newHostKey(t)
	hash, _ := auth.HashHostKey(visitor)

	// Fill the visitor's allowance directly (the HTTP rate limit would stop us first).
	for i := 0; i < 30; i++ {
		q := &entities.Quiz{Title: map[string]string{"en": "ACCESS-TEST quota"}, OwnerKeyHash: &hash}
		if err := h.quizUC.Create(ctx, q); err != nil {
			t.Fatalf("seed %d: %v", i, err)
		}
	}
	w := h.as(visitor, http.MethodPost, "/api/v1/quizzes", map[string]any{"title": map[string]any{"en": "ACCESS-TEST one too many"}})
	if w.Code != http.StatusConflict {
		t.Fatalf("31st quiz: %d %s, want 409", w.Code, w.Body.String())
	}
	// Admins are not subject to the visitor allowance.
	if w := h.as("admin", http.MethodPost, "/api/v1/quizzes", map[string]any{"title": map[string]any{"en": "ACCESS-TEST admin"}}); w.Code != http.StatusCreated {
		t.Fatalf("admin create: %d", w.Code)
	}

	// Text length and question count caps.
	other := newHostKey(t)
	long := strings.Repeat("x", 201)
	if w := h.as(other, http.MethodPost, "/api/v1/quizzes", map[string]any{"title": map[string]any{"en": long}}); w.Code != http.StatusBadRequest {
		t.Fatalf("overlong title: %d", w.Code)
	}
	id := decode(t, h.as(other, http.MethodPost, "/api/v1/quizzes", map[string]any{"title": map[string]any{"en": "ACCESS-TEST caps"}}))["id"].(string)
	qs := make([]any, 101)
	for i := range qs {
		qs[i] = sampleQuestions()["questions"].([]any)[0]
	}
	if w := h.as(other, http.MethodPut, "/api/v1/quizzes/"+id+"/questions", map[string]any{"questions": qs}); w.Code != http.StatusBadRequest {
		t.Fatalf("101 questions: %d %s", w.Code, w.Body.String())
	}
}

func TestVisitorCreationIsRateLimitedButAdminsAreNot(t *testing.T) {
	h := newHarness(t)
	visitor := newHostKey(t)

	created := 0
	for i := 0; i < 25; i++ {
		w := h.as(visitor, http.MethodPost, "/api/v1/quizzes", map[string]any{"title": map[string]any{"en": "ACCESS-TEST rate"}})
		if w.Code == http.StatusCreated {
			created++
			continue
		}
		if w.Code != http.StatusTooManyRequests || w.Header().Get("Retry-After") == "" {
			t.Fatalf("request %d: %d %s", i+1, w.Code, w.Body.String())
		}
	}
	if created != 20 {
		t.Fatalf("created %d quizzes before being limited, want 20", created)
	}
	for i := 0; i < 25; i++ {
		if w := h.as("admin", http.MethodPost, "/api/v1/quizzes", map[string]any{"title": map[string]any{"en": "ACCESS-TEST admin rate"}}); w.Code != http.StatusCreated {
			t.Fatalf("admin request %d throttled: %d", i+1, w.Code)
		}
	}
}

// PINs only have to be unique among games that can still be joined.
func TestPINIsReusableOnceAGameFinishes(t *testing.T) {
	h := newHarness(t)
	alice := newHostKey(t)
	id := h.createReadyQuiz(alice, "ACCESS-TEST pins")
	ctx := context.Background()

	insert := func(status string) error {
		_, err := h.pool.Exec(ctx, `INSERT INTO quiz_sessions (id, quiz_id, pin, status) VALUES ($1, $2, '424242', $3)`,
			uuid.New(), id, status)
		return err
	}
	if err := insert("finished"); err != nil {
		t.Fatal(err)
	}
	if err := insert("lobby"); err != nil {
		t.Fatalf("a finished game must not block its PIN: %v", err)
	}
	if err := insert("lobby"); err == nil {
		t.Fatal("two joinable games must not share a PIN")
	}

	// The lookup resolves to the game that can still be joined.
	w := h.as("", http.MethodGet, "/api/v1/sessions/pin/424242", nil)
	if w.Code != http.StatusOK || decode(t, w)["status"] != "lobby" {
		t.Fatalf("PIN lookup: %d %s", w.Code, w.Body.String())
	}
}

// A player's id is visible to everyone in the room (the public leaderboard
// lists it), so it cannot be what proves who is answering. The secret handed
// out at join can.
func TestPlayersNeedTheirOwnSecretToAnswerOrConnect(t *testing.T) {
	h := newHarness(t)
	host := newHostKey(t)
	quizID := h.createReadyQuiz(host, "ACCESS-TEST player secrets")
	sessionID := decode(t, h.as(host, http.MethodPost, "/api/v1/quizzes/"+quizID+"/sessions", nil))["id"].(string)

	var questions []map[string]any
	if err := json.Unmarshal(h.as(host, http.MethodGet, "/api/v1/quizzes/"+quizID+"/questions", nil).Body.Bytes(), &questions); err != nil || len(questions) == 0 {
		t.Fatalf("questions: %v", err)
	}
	questionID := questions[0]["id"].(string)

	if w := h.as(host, http.MethodPatch, "/api/v1/sessions/"+sessionID+"/start", nil); w.Code != http.StatusOK {
		t.Fatalf("start: %d", w.Code)
	}
	if w := h.as(host, http.MethodPatch, "/api/v1/sessions/"+sessionID+"/advance", map[string]any{"question_id": questionID}); w.Code != http.StatusOK {
		t.Fatalf("advance: %d %s", w.Code, w.Body.String())
	}

	join := func(name string) (id, secret string) {
		w := h.as("", http.MethodPost, "/api/v1/sessions/"+sessionID+"/players", map[string]any{"name": name})
		if w.Code != http.StatusCreated {
			t.Fatalf("join %s: %d %s", name, w.Code, w.Body.String())
		}
		body := decode(t, w)
		secret, _ = body["secret"].(string)
		return body["id"].(string), secret
	}
	annID, annSecret := join("Ann")
	_, bobSecret := join("Bob")
	if annSecret == "" || bobSecret == "" || annSecret == bobSecret {
		t.Fatalf("each player must get their own secret: %q %q", annSecret, bobSecret)
	}

	// Everyone can read the roster — and it must not contain a secret.
	roster := h.as("", http.MethodGet, "/api/v1/sessions/"+sessionID+"/leaderboard", nil).Body.String()
	if !strings.Contains(roster, annID) {
		t.Fatalf("leaderboard should list players: %s", roster)
	}
	for _, leaked := range []string{"secret", annSecret, bobSecret} {
		if strings.Contains(roster, leaked) {
			t.Fatalf("the leaderboard leaks %q: %s", leaked, roster)
		}
	}

	answer := func(playerID, secret string) int {
		body := map[string]any{
			"player_id": playerID, "question_id": questionID, "time_taken_ms": 500,
			"answer": map[string]any{"value": "4"},
		}
		if secret != "" {
			body["secret"] = secret
		}
		return h.as("", http.MethodPost, "/api/v1/sessions/"+sessionID+"/answer", body).Code
	}
	// Bob knows Ann's id (it is public) but not her secret.
	for name, secret := range map[string]string{"no secret": "", "bob's secret": bobSecret, "guess": "AAAA"} {
		if code := answer(annID, secret); code != http.StatusForbidden {
			t.Errorf("answering as Ann with %s: %d, want 403", name, code)
		}
	}
	if code := answer(annID, annSecret); code != http.StatusOK {
		t.Fatalf("Ann answering with her own secret: %d, want 200", code)
	}

	// The same rule guards her socket.
	srv := httptest.NewServer(h.router)
	defer srv.Close()
	dial := func(secret string) int {
		u := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws/sessions/" + sessionID + "/join?player_id=" + annID
		if secret != "" {
			u += "&secret=" + secret
		}
		conn, resp, err := websocket.DefaultDialer.Dial(u, nil)
		status := 0
		if resp != nil {
			status = resp.StatusCode
			_ = resp.Body.Close()
		}
		if err != nil && status == 0 {
			t.Fatalf("dial: %v", err)
		}
		if conn != nil {
			_ = conn.Close()
		}
		return status
	}
	if status := dial(""); status != http.StatusForbidden {
		t.Errorf("socket without a secret: %d, want 403", status)
	}
	if status := dial(bobSecret); status != http.StatusForbidden {
		t.Errorf("socket with Bob's secret: %d, want 403", status)
	}
	if status := dial(annSecret); status != http.StatusSwitchingProtocols {
		t.Errorf("socket with Ann's secret: %d, want 101", status)
	}
}

// Join input is bounded: the name and avatar are stored and broadcast to the room.
func TestJoiningRejectsOversizedOrUnsafeInput(t *testing.T) {
	h := newHarness(t)
	host := newHostKey(t)
	quizID := h.createReadyQuiz(host, "ACCESS-TEST join limits")
	sessionID := decode(t, h.as(host, http.MethodPost, "/api/v1/quizzes/"+quizID+"/sessions", nil))["id"].(string)
	join := func(body map[string]any) int {
		return h.as("", http.MethodPost, "/api/v1/sessions/"+sessionID+"/players", body).Code
	}

	if code := join(map[string]any{"name": strings.Repeat("x", 25)}); code != http.StatusBadRequest {
		t.Errorf("25-character name: %d, want 400", code)
	}
	if code := join(map[string]any{"name": "Tracker", "avatar_url": "https://attacker.example/pixel.gif"}); code != http.StatusBadRequest {
		t.Errorf("remote avatar: %d, want 400", code)
	}
	if code := join(map[string]any{"name": "Svg", "avatar_url": "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="}); code != http.StatusBadRequest {
		t.Errorf("svg avatar: %d, want 400", code)
	}
	if code := join(map[string]any{"name": "Huge", "avatar_url": "data:image/jpeg;base64," + strings.Repeat("A", 300_000)}); code != http.StatusRequestEntityTooLarge && code != http.StatusBadRequest {
		t.Errorf("huge avatar: %d, want 400/413", code)
	}
	if code := join(map[string]any{"name": "Sara", "avatar_url": "data:image/jpeg;base64,/9j/4AAQSkZJRg=="}); code != http.StatusCreated {
		t.Errorf("a normal avatar: %d, want 201", code)
	}
}

// A host who closes the tab never finishes their game; without a sweeper the
// game would hold its PIN for ever.
func TestAbandonedGamesAreClosedAndTheirPINFreed(t *testing.T) {
	h := newHarness(t)
	host := newHostKey(t)
	quizID := h.createReadyQuiz(host, "ACCESS-TEST abandoned")

	open := func() (id, pin string) {
		s := decode(t, h.as(host, http.MethodPost, "/api/v1/quizzes/"+quizID+"/sessions", nil))
		return s["id"].(string), s["pin"].(string)
	}
	oldID, oldPIN := open()
	_, freshPIN := open()
	if _, err := h.pool.Exec(context.Background(), `UPDATE quiz_sessions SET created_at = NOW() - INTERVAL '3 days' WHERE id = $1`, oldID); err != nil {
		t.Fatal(err)
	}

	repo := postgres.NewQuizSessionRepository(postgres.NewBaseRepository(h.pool, 30*time.Second))
	closed, err := repo.FinishStale(context.Background(), time.Now().Add(-24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if closed < 1 {
		t.Fatalf("closed %d games, want at least the abandoned one", closed)
	}

	if w := h.as("", http.MethodGet, "/api/v1/sessions/pin/"+oldPIN, nil); w.Code != http.StatusNotFound {
		t.Errorf("an abandoned game must stop resolving by PIN, got %d", w.Code)
	}
	if w := h.as("", http.MethodGet, "/api/v1/sessions/pin/"+freshPIN, nil); w.Code != http.StatusOK {
		t.Errorf("a game opened just now must be untouched, got %d", w.Code)
	}
}
