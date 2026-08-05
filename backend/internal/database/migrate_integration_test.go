package database

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// testPool returns a pool for the integration database, or skips.
//
// Same contract as the repository tests: point TEST_DATABASE_URL at a scratch
// database to run these. It must be a *scratch* database — Migrate writes to
// it. Requires the pgvector extension, which the baseline creates.
//
//	TEST_DATABASE_URL='postgres://user:pass@localhost:5432/skillture_test' go test ./internal/database/
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not set; skipping database integration test")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("TEST_DATABASE_URL is set but unreachable: %v", err)
	}
	return pool
}

func TestMigrateIsIdempotent(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	// Migrate runs on every boot, so running it twice has to be safe — and a
	// restarted container is exactly that.
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("first Migrate: %v", err)
	}
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("second Migrate: %v", err)
	}

	var applied int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations`).Scan(&applied); err != nil {
		t.Fatalf("count schema_migrations: %v", err)
	}

	expected, err := loadMigrations()
	if err != nil {
		t.Fatalf("loadMigrations: %v", err)
	}
	if applied != len(expected) {
		t.Errorf("schema_migrations holds %d rows, want %d — a migration ran twice or not at all", applied, len(expected))
	}
}

func TestMigrateAppliesSchemaCorrections(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	t.Run("no timestamp column lacks a time zone", func(t *testing.T) {
		var remaining int
		if err := pool.QueryRow(ctx, `
			SELECT count(*) FROM information_schema.columns
			WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
		`).Scan(&remaining); err != nil {
			t.Fatalf("query: %v", err)
		}
		if remaining != 0 {
			t.Errorf("%d columns are still TIMESTAMP WITHOUT TIME ZONE", remaining)
		}
	})

	t.Run("deleting a host keeps the session", func(t *testing.T) {
		// The defect this migration exists for: host_id was ON DELETE CASCADE,
		// and quiz_players and quiz_player_answers cascade from the session, so
		// removing one admin erased every game they had ever run.
		var sessions int
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin: %v", err)
		}
		defer tx.Rollback(ctx) //nolint:errcheck // rolled back on purpose

		if _, err := tx.Exec(ctx, `
			INSERT INTO admins (id, username, hashed_password)
			VALUES ('11111111-1111-1111-1111-111111111111', 'migrate-test-host', 'x');
			INSERT INTO quizzes (id, title, status)
			VALUES ('22222222-2222-2222-2222-222222222222', '{"en":"t"}', 0);
			INSERT INTO quiz_sessions (id, quiz_id, host_id, pin)
			VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
			        '11111111-1111-1111-1111-111111111111', 'MIGT1');
			DELETE FROM admins WHERE id = '11111111-1111-1111-1111-111111111111';
		`); err != nil {
			t.Fatalf("seed and delete: %v", err)
		}

		if err := tx.QueryRow(ctx,
			`SELECT count(*) FROM quiz_sessions WHERE id = '44444444-4444-4444-4444-444444444444' AND host_id IS NULL`,
		).Scan(&sessions); err != nil {
			t.Fatalf("count sessions: %v", err)
		}
		if sessions != 1 {
			t.Error("the session was destroyed with its host; host_id is still ON DELETE CASCADE")
		}
	})

	t.Run("status columns reject values outside their enum", func(t *testing.T) {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin: %v", err)
		}
		defer tx.Rollback(ctx) //nolint:errcheck // rolled back on purpose

		if _, err := tx.Exec(ctx,
			`INSERT INTO forms (id, title, status) VALUES (gen_random_uuid(), '{"en":"t"}', 9)`,
		); err == nil {
			t.Error("forms.status accepted 9; enums.FormStatus only defines 0, 1 and 2")
		}
	})

	t.Run("updated_at moves on update", func(t *testing.T) {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin: %v", err)
		}
		defer tx.Rollback(ctx) //nolint:errcheck // rolled back on purpose

		const formID = "77777777-7777-7777-7777-777777777777"
		const fieldID = "88888888-8888-8888-8888-888888888888"

		var before, after time.Time
		if err := tx.QueryRow(ctx, `
			WITH f AS (
				INSERT INTO forms (id, title, status) VALUES ($1, '{"en":"t"}', 0) RETURNING id
			)
			INSERT INTO form_fields (id, form_id, label, type, field_order, updated_at)
			SELECT $2, f.id, '{"en":"l"}', 1, 1, TIMESTAMPTZ '2000-01-01' FROM f
			RETURNING updated_at
		`, formID, fieldID).Scan(&before); err != nil {
			t.Fatalf("seed form and field: %v", err)
		}

		if err := tx.QueryRow(ctx,
			`UPDATE form_fields SET field_order = 2 WHERE id = $1 RETURNING updated_at`, fieldID,
		).Scan(&after); err != nil {
			t.Fatalf("update field: %v", err)
		}

		if !after.After(before) {
			t.Errorf("updated_at did not move: %s -> %s; the trigger is missing", before, after)
		}
	})
}
