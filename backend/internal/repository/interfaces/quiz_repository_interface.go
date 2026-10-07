package interfaces

import (
	"context"
	"time"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"

	"github.com/google/uuid"
)

// QuizFilter holds optional filter criteria for listing quizzes
type QuizFilter struct {
	Status *enums.QuizStatus // optional: filter by lifecycle status
	// OwnerKeyHash limits the list to quizzes created by one visitor.
	OwnerKeyHash *string
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
	// CountByOwner returns how many quizzes a visitor has created.
	CountByOwner(ctx context.Context, ownerKeyHash string) (int, error)
	// DeleteStaleVisitorQuizzes removes visitor-created quizzes created before
	// cutoff that have not been hosted since. Admin-created quizzes are never
	// touched. Returns the number deleted.
	DeleteStaleVisitorQuizzes(ctx context.Context, cutoff time.Time) (int64, error)
}
