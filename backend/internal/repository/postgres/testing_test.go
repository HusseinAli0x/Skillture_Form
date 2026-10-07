package postgres

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"skillture/backend/internal/database"

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
//
// migrateOnce brings the scratch database to the current schema, once per test
// binary. These tests used to assume the tables already existed, so they passed
// on a database someone had set up by hand and failed on a fresh one (CI) or
// whenever another package's tests had not yet run the migrations.
var migrateOnce sync.Once

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

	var migrateErr error
	migrateOnce.Do(func() { migrateErr = database.Migrate(context.Background(), pool) })
	require.NoError(t, migrateErr, "could not migrate the test database")

	return pool
}
