package entites

import (
	"time"
)

type Forms struct {
	ID          uuid.uuid `db:"id" json:"id"`
	Title       string    `db:"title" json:"title"`
	Description string    `db:"description" json:"description"`
	Status      int       `db:"status" json:"status"`
	CreatedAt   time.Time `db:"creat_at" json:"creat_at"`
}

func (Forms) TableName() string {
	return "forms"
}
