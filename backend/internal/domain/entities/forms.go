package entities

import (
	"errors"
	"skillture/backend/internal/domain/enums"
	"time"

	"github.com/google/uuid"
)

type Form struct {
	ID          uuid.UUID         `db:"id" json:"id"`
	Title       map[string]string `db:"title" json:"title"`
	Description map[string]string `db:"description" json:"description"`
	Status      enums.FormStatus  `db:"status" json:"status"`
	CreatedAt   time.Time         `db:"creat_at" json:"creat_at"`
}

var ErrInvalidFormStatus = errors.New("invalid form status")

// TableName returns the DB table name

func (Form) TableName() string {
	return "forms"
}

// IsActive checks if the form is active

func (f *Form) IsActive() bool {
	return f.Status == 1
}

// Deactivate marks the form as inactive
func (f *Form) Deactivate() {
	f.Status = 0
}

// IsValid validates domain rules
func (f *Form) IsValid() error {
	if !f.Status.IsValid() {
		return ErrInvalidFormStatus
	}
	return nil
}
