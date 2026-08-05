package postgres

import (
	"context"
	"fmt"
	"sync"
	"time"

	"skillture/backend/internal/repository/interfaces"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BaseRepository provides common database functionality
// shared across all PostgreSQL repositories.
// ****************************
// Responsibilities:
// - Enforce query timeout
// - Handle context creation
// - Support transactions
// - Abstract pgx pool vs transaction usage
// ****************************
// BaseRepository provides shared PostgreSQL functionality
// such as timeout handling and transaction support.
// ****************************
// It must NOT contain any business logic.
type BaseRepository struct {
	exec    interfaces.DBExecutor // Can be pgxpool.Pool or pgx.Tx
	timeout time.Duration         // Enforced timeout for all queries
}

// NewBaseRepository creates a BaseRepository using a pgx connection pool.
// This is used for non-transactional operations.
func NewBaseRepository(pool *pgxpool.Pool, timeout time.Duration) *BaseRepository {
	return &BaseRepository{exec: pool, timeout: timeout}
}

// context creates a new context with enforced timeout.
// If parent context is nil, context.Background is used.
func (r *BaseRepository) context(ctx context.Context) (context.Context, context.CancelFunc) {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithTimeout(ctx, r.timeout)
}

// WithTx executes the given function inside a database transaction.
//
// Behavior:
// - Begins transaction
// - Commits if fn returns nil
// - Rolls back if fn returns error
//
// A new BaseRepository bound to the transaction
// is passed to the callback.
func (r *BaseRepository) WithTx(ctx context.Context, fn func(txRepo *BaseRepository) error) error {
	if ctx == nil {
		ctx = context.Background()
	}

	// A transaction spans several statements, so it is NOT scoped to the
	// single-statement QueryTimeout — doing that also meant the rollback below
	// ran on an already-expired context and could not be delivered.
	beginner, ok := r.exec.(interface {
		Begin(ctx context.Context) (pgx.Tx, error)
	})
	if !ok {
		// Previously an unchecked type assertion, which panicked instead of
		// returning an error when the executor was already a transaction.
		return fmt.Errorf("WithTx: executor does not support transactions")
	}

	tx, err := beginner.Begin(ctx)
	if err != nil {
		return err
	}

	// Create repository bound to transaction
	txRepo := &BaseRepository{exec: tx, timeout: r.timeout}

	// Execute transactional logic
	if err := fn(txRepo); err != nil {
		// Roll back on a context that cannot already be cancelled by the
		// caller, otherwise a client disconnect leaves the transaction open
		// until the connection is reaped.
		rollbackCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), r.timeout)
		defer cancel()
		if rbErr := tx.Rollback(rollbackCtx); rbErr != nil && rbErr != pgx.ErrTxClosed {
			return fmt.Errorf("%w (rollback failed: %v)", err, rbErr)
		}
		return err
	}

	// Commit transaction
	return tx.Commit(ctx)
}

// Exec executes a statement (INSERT, UPDATE, DELETE)
// with enforced timeout.
func (r *BaseRepository) Exec(ctx context.Context, query string, args ...any) error {
	ctx, cancel := r.context(ctx)
	defer cancel()
	_, err := r.exec.Exec(ctx, query, args...)
	return err
}

// Query executes a SELECT query returning multiple rows.
//
// The timeout context stays alive until the returned Rows are closed. Calling
// cancel as soon as Query returned — as this used to — cancelled the context
// while the caller was still iterating, so rows.Next() stopped early and the
// reason was only visible through rows.Err(), which no caller checked. The
// symptom was list endpoints quietly returning fewer rows than exist.
func (r *BaseRepository) Query(ctx context.Context, query string, args ...any) (pgx.Rows, error) {
	ctx, cancel := r.context(ctx)

	rows, err := r.exec.Query(ctx, query, args...)
	if err != nil {
		cancel()
		return nil, err
	}
	return &cancelRows{Rows: rows, cancel: cancel}, nil
}

// cancelRows releases the query's timeout context when the rows are closed.
type cancelRows struct {
	pgx.Rows
	cancel context.CancelFunc
	once   sync.Once
}

func (c *cancelRows) Close() {
	c.Rows.Close()
	c.once.Do(c.cancel)
}

// QueryRow executes a SELECT query expected to return a single row.
//
// pgx defers the actual query until Scan is called, so the timeout context has
// to outlive this function. It is released when Scan runs; previously the
// CancelFunc was simply discarded, leaking a timer per call on the hottest
// path in the codebase.
func (r *BaseRepository) QueryRow(ctx context.Context, query string, args ...any) pgx.Row {
	ctx, cancel := r.context(ctx)
	return &cancelRow{Row: r.exec.QueryRow(ctx, query, args...), cancel: cancel}
}

// cancelRow releases the query's timeout context once the row is scanned.
type cancelRow struct {
	pgx.Row
	cancel context.CancelFunc
	once   sync.Once
}

func (c *cancelRow) Scan(dest ...any) error {
	defer c.once.Do(c.cancel)
	return c.Row.Scan(dest...)
}
