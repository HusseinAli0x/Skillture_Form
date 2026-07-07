package quiz

import (
	"context"
	"errors"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	repo "Skillture_Form/internal/repository/interfaces"
	uc "Skillture_Form/internal/usecase/interfaces"

	"github.com/google/uuid"
)

// quizUseCase is the concrete implementation of QuizUseCase.
type quizUseCase struct {
	quizRepo repo.QuizRepository
}

// Compile-time assertion
var _ uc.QuizUseCase = (*quizUseCase)(nil)

// NewQuizUseCase creates a new QuizUseCase.
// The quiz repository is injected for testability.
func NewQuizUseCase(quizRepo repo.QuizRepository) uc.QuizUseCase {
	return &quizUseCase{quizRepo: quizRepo}
}

// Create creates a new quiz in Draft status.
func (u *quizUseCase) Create(ctx context.Context, quiz *entities.Quiz) error {
	if len(quiz.Title) == 0 {
		return errors.New("quiz title is required")
	}
	if quiz.ID == uuid.Nil {
		quiz.ID = uuid.New()
	}
	// Always start as Draft; host explicitly activates when ready
	quiz.Status = enums.QuizStatusDraft
	return u.quizRepo.Create(ctx, quiz)
}

// Update modifies mutable fields of an existing quiz.
// Archived quizzes are locked and cannot be changed.
func (u *quizUseCase) Update(ctx context.Context, quiz *entities.Quiz) error {
	existing, err := u.quizRepo.GetByID(ctx, quiz.ID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("quiz not found")
	}
	if existing.Status == enums.QuizStatusArchived {
		return errors.New("archived quiz cannot be updated")
	}
	if len(quiz.Title) == 0 {
		return errors.New("quiz title is required")
	}
	// Preserve immutable fields
	quiz.Status = existing.Status
	quiz.CreatedAt = existing.CreatedAt
	return u.quizRepo.Update(ctx, quiz)
}

// Activate publishes a Draft quiz so live sessions can be created.
func (u *quizUseCase) Activate(ctx context.Context, quizID uuid.UUID) error {
	quiz, err := u.quizRepo.GetByID(ctx, quizID)
	if err != nil {
		return err
	}
	if quiz == nil {
		return errors.New("quiz not found")
	}
	if quiz.Status != enums.QuizStatusDraft {
		return errors.New("only draft quizzes can be activated")
	}
	quiz.Status = enums.QuizStatusActive
	return u.quizRepo.Update(ctx, quiz)
}

// Archive retires a quiz. No new sessions can be created after this.
func (u *quizUseCase) Archive(ctx context.Context, quizID uuid.UUID) error {
	quiz, err := u.quizRepo.GetByID(ctx, quizID)
	if err != nil {
		return err
	}
	if quiz == nil {
		return errors.New("quiz not found")
	}
	if quiz.Status == enums.QuizStatusArchived {
		return nil // idempotent
	}
	quiz.Status = enums.QuizStatusArchived
	return u.quizRepo.Update(ctx, quiz)
}

// Delete removes a quiz and all child records via DB cascade.
func (u *quizUseCase) Delete(ctx context.Context, quizID uuid.UUID) error {
	existing, err := u.quizRepo.GetByID(ctx, quizID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("quiz not found")
	}
	return u.quizRepo.Delete(ctx, quizID)
}

// GetByID retrieves a quiz by its primary key.
func (u *quizUseCase) GetByID(ctx context.Context, quizID uuid.UUID) (*entities.Quiz, error) {
	quiz, err := u.quizRepo.GetByID(ctx, quizID)
	if err != nil {
		return nil, err
	}
	if quiz == nil {
		return nil, errors.New("quiz not found")
	}
	return quiz, nil
}

// List returns quizzes matching the optional filter.
func (u *quizUseCase) List(ctx context.Context, filter uc.QuizFilter) ([]*entities.Quiz, error) {
	return u.quizRepo.List(ctx, repo.QuizFilter{Status: filter.Status})
}
