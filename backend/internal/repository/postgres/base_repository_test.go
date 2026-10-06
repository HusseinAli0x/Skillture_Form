package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestBaseRepository_CRUD(t *testing.T) {
	// =========================
	//    DB test
	// =========================
	pool := testPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// =========================
	//  Clear admins Table
	// =========================
	err := func() error {
		_, err := pool.Exec(ctx, "TRUNCATE TABLE admins RESTART IDENTITY CASCADE;")
		return err
	}()
	require.NoError(t, err)

	// =========================
	// Create BaseRepository
	// =========================
	baseRepo := NewBaseRepository(pool, 2*time.Second)

	// =========================
	//  Exec (INSERT)
	// =========================
	err = baseRepo.Exec(ctx,
		"INSERT INTO admins (id, username, hashed_password, created_at) VALUES (gen_random_uuid(), $1, $2, NOW())",
		"base_admin", "pass123",
	)
	require.NoError(t, err)

	// =========================
	//  QueryRow (SELECT one row )
	// =========================
	var username string
	err = baseRepo.QueryRow(ctx,
		"SELECT username FROM admins WHERE username=$1",
		"base_admin",
	).Scan(&username)
	require.NoError(t, err)
	require.Equal(t, "base_admin", username)

	// =========================
	//  Query (SELECT )
	// =========================
	rows, err := baseRepo.Query(ctx, "SELECT username FROM admins")
	require.NoError(t, err)
	defer rows.Close()

	var users []string
	for rows.Next() {
		var u string
		err := rows.Scan(&u)
		require.NoError(t, err)
		users = append(users, u)
	}
	require.Len(t, users, 1)
	require.Equal(t, "base_admin", users[0])

	// =========================
	//  WithTx ()
	// =========================
	err = baseRepo.WithTx(ctx, func(txRepo *BaseRepository) error {
		return txRepo.Exec(ctx,
			"INSERT INTO admins (id, username, hashed_password, created_at) VALUES (gen_random_uuid(), $1, $2, NOW())",
			"tx_admin", "tx_pass",
		)
	})
	require.NoError(t, err)

	// =========================
	// =========================
	var count int
	err = baseRepo.QueryRow(ctx, "SELECT COUNT(*) FROM admins WHERE username=$1", "tx_admin").Scan(&count)
	require.NoError(t, err)
	require.Equal(t, 1, count)
}
