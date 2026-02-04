package postgres

import (
	"context"
	"time"

	"Skillture_Form/internal/repository/interfaces"

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
	ctx, cancel := r.context(ctx)
	defer cancel()
	// Start transaction from the underlying executor
	tx, err := r.exec.(interface {
		Begin(ctx context.Context) (pgx.Tx, error)
	}).Begin(ctx)
	if err != nil {
		return err
	}
	// Create repository bound to transaction
	txRepo := &BaseRepository{exec: tx, timeout: r.timeout}
	// Execute transactional logic
	if err := fn(txRepo); err != nil {
		_ = tx.Rollback(ctx)
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
func (r *BaseRepository) Query(ctx context.Context, query string, args ...any) (pgx.Rows, error) {
	ctx, cancel := r.context(ctx)
	defer cancel()
	return r.exec.Query(ctx, query, args...)
}

// QueryRow executes a SELECT query expected to return a single row.
//
// NOTE:
// pgx.Row does not expose context cancellation,
// but timeout is still enforced at query start.
func (r *BaseRepository) QueryRow(ctx context.Context, query string, args ...any) pgx.Row {
	ctx, _ = r.context(ctx)
	return r.exec.QueryRow(ctx, query, args...)
}
