package database

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Migrations are embedded so the binary carries its own schema. Nothing has to
// be mounted, copied into the image, or applied by hand before the app starts.
//
//go:embed migrations/*.sql
var migrationFS embed.FS

// advisoryLockKey namespaces the Postgres advisory lock taken while migrating.
// Two backend replicas starting at once must not both apply the same file; the
// second blocks here and then finds nothing left to do.
const advisoryLockKey int64 = 0x5C177_012E // "skillture" migrations

// migration is one file from the embedded directory.
type migration struct {
	version int64
	name    string
	sql     string
}

// Migrate applies every migration newer than the recorded schema version.
//
// This replaces mounting schema.sql into docker-entrypoint-initdb.d, which
// only ran on an empty data volume — so every schema change previously meant
// `docker compose down -v` and the loss of all data.
//
// Deliberately forward-only: there are no .down.sql files. Rolling a
// production schema backwards is rarely what is actually wanted, and a
// half-applied "down" is worse than the change it undoes. To reverse
// something, write the next migration.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	migrations, err := loadMigrations()
	if err != nil {
		return err
	}

	// The lock is held on one connection for the whole run, so it must be
	// acquired and released on that same connection rather than through the
	// pool.
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("migrate: acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, advisoryLockKey); err != nil {
		return fmt.Errorf("migrate: acquire advisory lock: %w", err)
	}
	defer func() {
		// Released on a fresh context: if ctx is already cancelled the unlock
		// would never be delivered, and the lock would be held until the
		// connection is reaped.
		if _, err := conn.Exec(context.WithoutCancel(ctx), `SELECT pg_advisory_unlock($1)`, advisoryLockKey); err != nil {
			log.Printf("migrate: failed to release advisory lock: %v", err)
		}
	}()

	if _, err := conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    BIGINT      PRIMARY KEY,
			name       TEXT        NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("migrate: create schema_migrations: %w", err)
	}

	applied := make(map[int64]bool)
	rows, err := conn.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("migrate: read applied versions: %w", err)
	}
	for rows.Next() {
		var version int64
		if err := rows.Scan(&version); err != nil {
			rows.Close()
			return fmt.Errorf("migrate: scan applied version: %w", err)
		}
		applied[version] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("migrate: read applied versions: %w", err)
	}

	pending := 0
	for _, m := range migrations {
		if applied[m.version] {
			continue
		}
		pending++

		// One transaction per migration, so a failure leaves the schema at the
		// last complete version rather than part-way through this one.
		tx, err := conn.Begin(ctx)
		if err != nil {
			return fmt.Errorf("migrate: begin %s: %w", m.name, err)
		}

		if _, err := tx.Exec(ctx, m.sql); err != nil {
			_ = tx.Rollback(context.WithoutCancel(ctx))
			return fmt.Errorf("migrate: apply %s: %w", m.name, err)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`, m.version, m.name,
		); err != nil {
			_ = tx.Rollback(context.WithoutCancel(ctx))
			return fmt.Errorf("migrate: record %s: %w", m.name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("migrate: commit %s: %w", m.name, err)
		}

		log.Printf("migrate: applied %s", m.name)
	}

	if pending == 0 {
		log.Printf("migrate: schema up to date (%d applied)", len(applied))
	}
	return nil
}

// loadMigrations reads the embedded directory in version order.
//
// Filenames are `<version>_<description>.up.sql`, e.g. 0001_baseline.up.sql.
func loadMigrations() ([]migration, error) {
	entries, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		return nil, fmt.Errorf("migrate: read embedded migrations: %w", err)
	}

	var migrations []migration
	seen := make(map[int64]string)

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".up.sql") {
			continue
		}

		version, err := parseVersion(entry.Name())
		if err != nil {
			return nil, err
		}
		// Two files claiming one version would apply in an order that depends
		// on the filesystem, and only one of them would ever be recorded.
		if other, dup := seen[version]; dup {
			return nil, fmt.Errorf("migrate: duplicate version %d in %s and %s", version, other, entry.Name())
		}
		seen[version] = entry.Name()

		body, err := migrationFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return nil, fmt.Errorf("migrate: read %s: %w", entry.Name(), err)
		}

		migrations = append(migrations, migration{
			version: version,
			name:    entry.Name(),
			sql:     string(body),
		})
	}

	// Sorted numerically, not lexically: 0010 must follow 0009, and would not
	// if the version stayed a string.
	sort.Slice(migrations, func(i, j int) bool { return migrations[i].version < migrations[j].version })
	return migrations, nil
}

func parseVersion(filename string) (int64, error) {
	prefix, _, found := strings.Cut(filename, "_")
	if !found {
		return 0, fmt.Errorf("migrate: %s is not named <version>_<description>.up.sql", filename)
	}
	version, err := strconv.ParseInt(prefix, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("migrate: %s has a non-numeric version prefix: %w", filename, err)
	}
	if version <= 0 {
		return 0, fmt.Errorf("migrate: %s has version %d; versions start at 1", filename, version)
	}
	return version, nil
}
