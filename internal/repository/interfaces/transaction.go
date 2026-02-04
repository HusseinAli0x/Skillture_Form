package interfaces

import "context"

// Transaction defines a single DB transaction
type Transaction interface {
	Commit(ctx context.Context) error
	Rollback(ctx context.Context) error
}

// UnitOfWork defines methods to start a transaction and get repositories within it
type UnitOfWork interface {
	// Begin starts a new transaction
	Begin(ctx context.Context) (Transaction, error)
}
