package entites

import (
	"time"
)

type Admins struct {
	ID             uuid.uuid `db:"id" json:"id"`
	UserName       string    `db:"username" json:"username"`
	HashedPassword string    `db:"hashed_password" json:"-"`
	CreateAt       time.Time `db:"created_at" json:"created_at"`
}

// TableName returns the table name in the DB
func (Admins) TableName() string {
	return "admins"
}
func (a *Admins) HasPassword() bool {
	return a.HasPassword()
}
func (a *Admins) CanLogin() bool {
	return true
}
