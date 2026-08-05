package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

// testPool returns a connection pool for the integration test database, or
// skips the calling test when one is not configured.
//
// These tests previously hardcoded localhost:5432 with a personal username and
// password, so `go test ./...` failed on every machine that did not happen to
// have that exact database. Point TEST_DATABASE_URL at a scratch database to
// run them, e.g.
//
//	TEST_DATABASE_URL='postgres://user:pass@localhost:5432/skillture_test' go test ./...
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not set; skipping database integration test")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, pool.Ping(ctx), "TEST_DATABASE_URL is set but unreachable")

	return pool
}
