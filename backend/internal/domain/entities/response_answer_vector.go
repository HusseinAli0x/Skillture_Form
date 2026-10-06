package entities

import (
	"errors"
	"time"

	"skillture/backend/internal/domain/enums"

	"github.com/google/uuid"
)

// Domain errors
var (
	ErrMissingEmbedding        = errors.New("embedding is missing")
	ErrMissingResponseAnswerID = errors.New("response answer ID is missing")
	ErrInvalidModelName        = errors.New("invalid model name")
)

type ResponseAnswerVector struct {
	ID               uuid.UUID       `db:"id" json:"id"`
	ResponseAnswerID uuid.UUID       `db:"response_answer_id" json:"response_answer_id"`
	Embedding        []float32       `db:"embedding" json:"embedding"`             // Vector (1536 dimensions)
	ModelName        enums.ModelName `db:"model_name" json:"model_name,omitempty"` // Enum
	CreatedAt        time.Time       `db:"created_at" json:"created_at"`
}

// TableName returns the DB table name
func (ResponseAnswerVector) TableName() string {
	return "response_answer_vectors"
}

// HasEmbedding checks if the embedding exists
func (v *ResponseAnswerVector) HasEmbedding() bool {
	return len(v.Embedding) > 0
}

// IsValid checks domain-level rules
func (v *ResponseAnswerVector) IsValid() error {
	if v.ResponseAnswerID == uuid.Nil {
		return ErrMissingResponseAnswerID
	}

	if !v.HasEmbedding() {
		return ErrMissingEmbedding
	}

	if v.ModelName != "" && !v.ModelName.IsValid() {
		return ErrInvalidModelName
	}

	return nil
}
