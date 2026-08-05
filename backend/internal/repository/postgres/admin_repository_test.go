package postgres

import (
	"context"
	"fmt"
	"testing"
	"time"

	"skillture/backend/internal/domain/entities"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func TestAdminRepository_CRUD(t *testing.T) {
	// =========================
	// Direct connection to test DB
	// =========================
	dbHost := "localhost"
	dbPort := "5432"
	dbUser := "hussein"
	dbPassword := "hussein"
	dbName := "skillture_test"
	dbSSLMode := "disable"

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName, dbSSLMode,
	)

	pool, err := pgxpool.New(context.Background(), connStr)
	require.NoError(t, err)
	defer pool.Close()

	// Ping the database to make sure it's alive
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	require.NoError(t, pool.Ping(ctx))

	// =========================
	// Create repository
	// =========================
	repo := NewAdminRepository(NewBaseRepository(pool, 2*time.Second))

	// =========================
	// Test CRUD operations
	// =========================

	// ===== Create =====
	admin := &entities.Admin{
		Username:       "admin1",
		HashedPassword: "hashed_pass",
	}
	err = repo.Create(context.Background(), admin)
	require.NoError(t, err)
	require.NotEqual(t, uuid.Nil, admin.ID)

	// ===== GetByID =====
	got, err := repo.GetByID(context.Background(), admin.ID)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, "admin1", got.Username)

	// ===== GetByUsername =====
	got2, err := repo.GetByUsername(context.Background(), "admin1")
	require.NoError(t, err)
	require.NotNil(t, got2)
	require.Equal(t, admin.ID, got2.ID)

	// ===== Update =====
	admin.Username = "admin_updated"
	err = repo.Update(context.Background(), admin)
	require.NoError(t, err)

	updated, err := repo.GetByID(context.Background(), admin.ID)
	require.NoError(t, err)
	require.Equal(t, "admin_updated", updated.Username)

	// ===== List =====
	list, err := repo.List(context.Background())
	require.NoError(t, err)
	require.Len(t, list, 1)

	// ===== Delete =====
	err = repo.Delete(context.Background(), admin.ID)
	require.NoError(t, err)

	deleted, err := repo.GetByID(context.Background(), admin.ID)
	require.NoError(t, err)
	require.Nil(t, deleted)
}
