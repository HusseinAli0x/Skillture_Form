package postgres

import (
	"Skillture_Form/internal/repository/interfaces"
	"context"
	"database/sql"
)

// PgTransaction implements interfaces.Transaction
type PgTransaction struct {
	tx *sql.Tx
}

func (t *PgTransaction) Commit(ctx context.Context) error {
	return t.tx.Commit()
}

func (t *PgTransaction) Rollback(ctx context.Context) error {
	return t.tx.Rollback()
}

// PgUnitOfWork implements interfaces.UnitOfWork
type PgUnitOfWork struct {
	db *sql.DB
}

// Constructor
func NewPgUnitOfWork(db *sql.DB) *PgUnitOfWork {
	return &PgUnitOfWork{db: db}
}

// Begin starts a new transaction
func (u *PgUnitOfWork) Begin(ctx context.Context) (interfaces.Transaction, error) {
	tx, err := u.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &PgTransaction{tx: tx}, nil
}
