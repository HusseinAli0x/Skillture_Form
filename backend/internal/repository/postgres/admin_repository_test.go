package postgres

import (
	"context"
	"testing"
	"time"

	"skillture/backend/internal/domain/entities"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestAdminRepository_CRUD(t *testing.T) {
	// =========================
	// Connection to test DB
	// =========================
	pool := testPool(t)

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
	err := repo.Create(context.Background(), admin)
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
