package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"skillture/backend/internal/config"
	"skillture/backend/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Integration tests for workshop registration. They need a real Postgres
// because the behaviour that matters — one seat taken by two people at once,
// case-insensitive duplicate emails — is enforced by the database.
//
//	TEST_DATABASE_URL='postgres://user:pass@localhost:5432/skillture_test' go test ./internal/server/handlers/
//
// They skip when TEST_DATABASE_URL is not set, like the repository tests.

var (
	regPool     *pgxpool.Pool
	regPoolOnce sync.Once
)

func registrationPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping workshop registration integration tests")
	}
	regPoolOnce.Do(func() {
		ctx := context.Background()
		pool, err := pgxpool.New(ctx, url)
		if err != nil {
			t.Fatalf("connect: %v", err)
		}
		if err := pool.Ping(ctx); err != nil {
			t.Fatalf("ping: %v", err)
		}
		if err := database.Migrate(ctx, pool); err != nil {
			t.Fatalf("migrate: %v", err)
		}
		regPool = pool
	})
	if regPool == nil {
		t.Fatal("test pool unavailable")
	}
	return regPool
}

func registrationRouter(pool *pgxpool.Pool) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewWorkshopHandler(pool, config.UploadConfig{})
	r := gin.New()
	r.POST("/workshops/:id/register", h.Register)
	r.GET("/workshops/:id", h.GetByID)
	r.GET("/admin/workshops/:id/registrations", h.ListRegistrations)
	r.GET("/admin/workshops/:id/registrations.csv", h.ExportRegistrations)
	r.DELETE("/admin/workshops/:id/registrations/:rid", h.DeleteRegistration)
	return r
}

type workshopFixture struct {
	date     string // YYYY-MM-DD
	open     bool
	capacity *int
}

func newWorkshop(t *testing.T, pool *pgxpool.Pool, f workshopFixture) uuid.UUID {
	t.Helper()
	id := uuid.New()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO workshops (id, title, description, event_date, registration_open, capacity, created_at, updated_at)
		VALUES ($1, '{"en":"Reg test","ar":"اختبار"}', '{"en":"d","ar":"و"}', $2, $3, $4, NOW(), NOW())
	`, id, f.date, f.open, f.capacity)
	if err != nil {
		t.Fatalf("insert workshop: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM workshops WHERE id = $1`, id)
	})
	return id
}

func future() string { return time.Now().UTC().AddDate(0, 0, 30).Format("2006-01-02") }
func past() string   { return time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02") }

func post(r *gin.Engine, id uuid.UUID, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/workshops/"+id.String()+"/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func get(r *gin.Engine, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w
}

func errorCode(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not JSON: %q", w.Body.String())
	}
	return body.Code
}

func TestRegisterHappyPathAndList(t *testing.T) {
	pool := registrationPool(t)
	r := registrationRouter(pool)
	id := newWorkshop(t, pool, workshopFixture{date: future(), open: true})

	w := post(r, id, `{"name":"  Sara   Ali ","email":"Sara@Example.COM"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("register: %d %s", w.Code, w.Body.String())
	}

	list := get(r, "/admin/workshops/"+id.String()+"/registrations")
	var rows []registrant
	if err := json.Unmarshal(list.Body.Bytes(), &rows); err != nil || len(rows) != 1 {
		t.Fatalf("list: %v %s", err, list.Body.String())
	}
	if rows[0].Name != "Sara Ali" || rows[0].Email != "sara@example.com" {
		t.Fatalf("stored (%q, %q), want trimmed name and lower-cased email", rows[0].Name, rows[0].Email)
	}

	detail := get(r, "/workshops/"+id.String())
	var ws workshop
	if err := json.Unmarshal(detail.Body.Bytes(), &ws); err != nil {
		t.Fatal(err)
	}
	if ws.Registered != 1 || ws.RegistrationStatus != "open" || ws.SpotsLeft != nil {
		t.Fatalf("detail: registered=%d status=%q spotsLeft=%v", ws.Registered, ws.RegistrationStatus, ws.SpotsLeft)
	}
}

func TestRegisterRejectsDuplicateEmailCaseInsensitively(t *testing.T) {
	pool := registrationPool(t)
	r := registrationRouter(pool)
	id := newWorkshop(t, pool, workshopFixture{date: future(), open: true})

	if w := post(r, id, `{"name":"A","email":"dup@example.com"}`); w.Code != http.StatusCreated {
		t.Fatalf("first: %d", w.Code)
	}
	w := post(r, id, `{"name":"B","email":"DUP@Example.com"}`)
	if w.Code != http.StatusConflict || errorCode(t, w) != regCodeAlreadyRegisterd {
		t.Fatalf("duplicate: %d %s", w.Code, w.Body.String())
	}

	// The same address may register for a different workshop.
	other := newWorkshop(t, pool, workshopFixture{date: future(), open: true})
	if w := post(r, other, `{"name":"A","email":"dup@example.com"}`); w.Code != http.StatusCreated {
		t.Fatalf("other workshop: %d", w.Code)
	}
}

func TestRegisterRespectsCapacity(t *testing.T) {
	pool := registrationPool(t)
	r := registrationRouter(pool)
	two := 2
	id := newWorkshop(t, pool, workshopFixture{date: future(), open: true, capacity: &two})

	for i, email := range []string{"a@example.com", "b@example.com"} {
		if w := post(r, id, `{"name":"P","email":"`+email+`"}`); w.Code != http.StatusCreated {
			t.Fatalf("seat %d: %d %s", i+1, w.Code, w.Body.String())
		}
	}
	w := post(r, id, `{"name":"P","email":"c@example.com"}`)
	if w.Code != http.StatusConflict || errorCode(t, w) != regCodeFull {
		t.Fatalf("third: %d %s", w.Code, w.Body.String())
	}

	var ws workshop
	_ = json.Unmarshal(get(r, "/workshops/"+id.String()).Body.Bytes(), &ws)
	if ws.RegistrationStatus != "full" || ws.SpotsLeft == nil || *ws.SpotsLeft != 0 {
		t.Fatalf("detail: status=%q spotsLeft=%v", ws.RegistrationStatus, ws.SpotsLeft)
	}
}

// Many people click at once for the last seats: exactly `capacity` may win.
func TestRegisterCapacityHoldsUnderConcurrency(t *testing.T) {
	pool := registrationPool(t)
	r := registrationRouter(pool)
	three := 3
	id := newWorkshop(t, pool, workshopFixture{date: future(), open: true, capacity: &three})

	var ok, full int32
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			body := `{"name":"P","email":"p` + uuid.NewString()[:8] + `@example.com"}`
			switch w := post(r, id, body); w.Code {
			case http.StatusCreated:
				atomic.AddInt32(&ok, 1)
			case http.StatusConflict:
				atomic.AddInt32(&full, 1)
			default:
				t.Errorf("unexpected %d: %s", w.Code, w.Body.String())
			}
		}(i)
	}
	wg.Wait()

	if ok != 3 || full != 17 {
		t.Fatalf("accepted %d, turned away %d; want 3 and 17", ok, full)
	}
	var n int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM workshop_registrations WHERE workshop_id = $1`, id).Scan(&n); err != nil || n != 3 {
		t.Fatalf("rows = %d (%v), want 3", n, err)
	}
}

func TestRegisterRefusesClosedEndedAndUnknown(t *testing.T) {
	pool := registrationPool(t)
	r := registrationRouter(pool)

	closed := newWorkshop(t, pool, workshopFixture{date: future(), open: false})
	if w := post(r, closed, `{"name":"A","email":"a@example.com"}`); w.Code != http.StatusUnprocessableEntity || errorCode(t, w) != regCodeClosed {
		t.Fatalf("closed: %d %s", w.Code, w.Body.String())
	}

	ended := newWorkshop(t, pool, workshopFixture{date: past(), open: true})
	if w := post(r, ended, `{"name":"A","email":"a@example.com"}`); w.Code != http.StatusUnprocessableEntity || errorCode(t, w) != regCodeEnded {
		t.Fatalf("ended: %d %s", w.Code, w.Body.String())
	}

	if w := post(r, uuid.New(), `{"name":"A","email":"a@example.com"}`); w.Code != http.StatusNotFound || errorCode(t, w) != regCodeNotFound {
		t.Fatalf("unknown: %d %s", w.Code, w.Body.String())
	}
}

func TestRegisterValidationAndHoneypot(t *testing.T) {
	pool := registrationPool(t)
	r := registrationRouter(pool)
	id := newWorkshop(t, pool, workshopFixture{date: future(), open: true})

	for body, want := range map[string]string{
		`{"name":"","email":"a@example.com"}`: regCodeNameRequired,
		`{"name":"A","email":"nope"}`:         regCodeEmailInvalid,
	} {
		if w := post(r, id, body); w.Code != http.StatusBadRequest || errorCode(t, w) != want {
			t.Errorf("%s -> %d %s, want 400 %s", body, w.Code, w.Body.String(), want)
		}
	}

	// A bot fills the hidden field: looks like success, stores nothing.
	if w := post(r, id, `{"name":"Bot","email":"bot@example.com","website":"http://spam.example"}`); w.Code != http.StatusCreated {
		t.Fatalf("honeypot response: %d", w.Code)
	}
	var n int
	_ = pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM workshop_registrations WHERE workshop_id = $1`, id).Scan(&n)
	if n != 0 {
		t.Fatalf("honeypot submission was stored (%d rows)", n)
	}
}

func TestExportAndDeleteRegistrations(t *testing.T) {
	pool := registrationPool(t)
	r := registrationRouter(pool)
	id := newWorkshop(t, pool, workshopFixture{date: future(), open: true})

	post(r, id, `{"name":"=HYPERLINK(\"http://evil.example\")","email":"evil@example.com"}`)
	post(r, id, `{"name":"سارة علي","email":"sara@example.com"}`)

	w := get(r, "/admin/workshops/"+id.String()+"/registrations.csv")
	if w.Code != http.StatusOK {
		t.Fatalf("export: %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/csv") {
		t.Fatalf("content type %q", ct)
	}
	if cd := w.Header().Get("Content-Disposition"); !strings.Contains(cd, "attachment") || !strings.Contains(cd, "reg-test") {
		t.Fatalf("content disposition %q", cd)
	}
	body := w.Body.String()
	if !strings.HasPrefix(body, "\xEF\xBB\xBF") {
		t.Fatal("export should start with a UTF-8 byte order mark so Excel reads Arabic")
	}
	if !strings.Contains(body, "Name,Email,Registered at (UTC)") {
		t.Fatalf("missing header row: %q", body)
	}
	if !strings.Contains(body, "'=HYPERLINK") || strings.Contains(body, ",=HYPERLINK") || strings.Contains(body, "\n=HYPERLINK") {
		t.Fatalf("formula was not neutralised: %q", body)
	}
	if !strings.Contains(body, "سارة علي") {
		t.Fatalf("arabic name lost: %q", body)
	}

	var rows []registrant
	_ = json.Unmarshal(get(r, "/admin/workshops/"+id.String()+"/registrations").Body.Bytes(), &rows)
	if len(rows) != 2 {
		t.Fatalf("rows = %d", len(rows))
	}

	// Deleting through another workshop's URL must not work.
	other := newWorkshop(t, pool, workshopFixture{date: future(), open: true})
	req := httptest.NewRequest(http.MethodDelete, "/admin/workshops/"+other.String()+"/registrations/"+rows[0].ID, nil)
	dw := httptest.NewRecorder()
	r.ServeHTTP(dw, req)
	if dw.Code != http.StatusNotFound {
		t.Fatalf("cross-workshop delete: %d, want 404", dw.Code)
	}

	req = httptest.NewRequest(http.MethodDelete, "/admin/workshops/"+id.String()+"/registrations/"+rows[0].ID, nil)
	dw = httptest.NewRecorder()
	r.ServeHTTP(dw, req)
	if dw.Code != http.StatusOK {
		t.Fatalf("delete: %d", dw.Code)
	}
	rows = nil
	_ = json.Unmarshal(get(r, "/admin/workshops/"+id.String()+"/registrations").Body.Bytes(), &rows)
	if len(rows) != 1 {
		t.Fatalf("rows after delete = %d", len(rows))
	}
}

func TestRegistrationsCascadeWithWorkshop(t *testing.T) {
	pool := registrationPool(t)
	r := registrationRouter(pool)
	id := newWorkshop(t, pool, workshopFixture{date: future(), open: true})
	post(r, id, `{"name":"A","email":"a@example.com"}`)

	if _, err := pool.Exec(context.Background(), `DELETE FROM workshops WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	var n int
	_ = pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM workshop_registrations WHERE workshop_id = $1`, id).Scan(&n)
	if n != 0 {
		t.Fatalf("registrations should be removed with their workshop, %d remain", n)
	}
}
