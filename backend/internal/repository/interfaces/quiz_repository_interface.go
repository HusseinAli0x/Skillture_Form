package interfaces

import (
	"context"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"

	"github.com/google/uuid"
)

// QuizFilter holds optional filter criteria for listing quizzes
type QuizFilter struct {
	Status *enums.QuizStatus // optional: filter by lifecycle status
}

// QuizRepository defines persistence operations for the Quiz aggregate
type QuizRepository interface {
	// Create inserts a new quiz. Sets a generated UUID if ID is nil.
	Create(ctx context.Context, quiz *entities.Quiz) error
	// GetByID retrieves a quiz by its primary key. Returns nil, nil when not found.
	GetByID(ctx context.Context, id uuid.UUID) (*entities.Quiz, error)
	// Update modifies an existing quiz's mutable fields.
	Update(ctx context.Context, quiz *entities.Quiz) error
	// Delete removes a quiz and cascades to questions/sessions.
	Delete(ctx context.Context, id uuid.UUID) error
	// List retrieves quizzes matching the optional filter.
	List(ctx context.Context, filter QuizFilter) ([]*entities.Quiz, error)
}
