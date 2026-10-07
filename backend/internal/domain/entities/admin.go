package entities

import (
	"time"

	"github.com/google/uuid"
)

type Admin struct {
	ID             uuid.UUID `db:"id" json:"id"`
	Username       string    `db:"username" json:"username"`
	HashedPassword string    `db:"hashed_password" json:"-"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

// TableName returns the database table name for the entity

func (Admin) TableName() string {
	return "admins"
}

// HasPassword checks if the admin has a password set

func (a *Admin) HasPassword() bool {
	return a.HashedPassword != ""
}

// CanLogin checks if the admin is allowed to login

func (a *Admin) CanLogin() bool {
	return true
}
