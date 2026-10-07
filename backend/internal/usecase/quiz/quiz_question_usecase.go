package quiz

import (
	"context"
	"errors"

	"skillture/backend/internal/domain/entities"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"
	uc "skillture/backend/internal/usecase/interfaces"

	"github.com/google/uuid"
)

// quizQuestionUseCase is the concrete implementation of QuizQuestionUseCase.
type quizQuestionUseCase struct {
	quizRepo     repo.QuizRepository
	questionRepo repo.QuizQuestionRepository
}

// Compile-time assertion
var _ uc.QuizQuestionUseCase = (*quizQuestionUseCase)(nil)

// NewQuizQuestionUseCase creates a new QuizQuestionUseCase.
func NewQuizQuestionUseCase(
	quizRepo repo.QuizRepository,
	questionRepo repo.QuizQuestionRepository,
) uc.QuizQuestionUseCase {
	return &quizQuestionUseCase{
		quizRepo:     quizRepo,
		questionRepo: questionRepo,
	}
}

// Create adds a new question to a quiz.
// Validates domain rules (type, options, time limit, points) before persisting.
func (u *quizQuestionUseCase) Create(ctx context.Context, question *entities.QuizQuestion) error {
	// Parent quiz must exist
	quiz, err := u.quizRepo.GetByID(ctx, question.QuizID)
	if err != nil {
		return err
	}
	if quiz == nil {
		return domainErrors.ErrNotFound
	}

	if question.ID == uuid.Nil {
		question.ID = uuid.New()
	}

	// Position is 1-based and unique per quiz. A request that omits it (or
	// sends 0, which Go's validator cannot distinguish from absent) appends to
	// the end rather than being rejected.
	if question.Position <= 0 {
		existing, err := u.questionRepo.List(ctx, repo.QuizQuestionFilter{QuizID: &question.QuizID})
		if err != nil {
			return err
		}
		question.Position = len(existing) + 1
	}

	// Delegate domain invariant checks to the entity
	if err := question.IsValid(); err != nil {
		return err
	}

	return u.questionRepo.Create(ctx, question)
}

// Update modifies an existing question's content.
//
// quizID is the quiz from the route. The handlers used to read only :qid and
// ignore :id, so any authenticated admin could rewrite any question in the
// system by addressing it through a quiz they owned — the URL implied a
// containment the code never checked.
func (u *quizQuestionUseCase) Update(ctx context.Context, quizID uuid.UUID, question *entities.QuizQuestion) error {
	existing, err := u.questionRepo.GetByID(ctx, question.ID)
	if err != nil {
		return err
	}
	// Not-found rather than forbidden: a caller poking at ids should not learn
	// that a question exists under some other quiz.
	if existing == nil || existing.QuizID != quizID {
		return domainErrors.ErrNotFound
	}

	// Preserve immutable parent link and timestamps
	question.QuizID = existing.QuizID
	question.CreatedAt = existing.CreatedAt

	if err := question.IsValid(); err != nil {
		return err
	}

	return u.questionRepo.Update(ctx, question)
}

// Delete removes a question, scoped to its quiz. See Update.
func (u *quizQuestionUseCase) Delete(ctx context.Context, quizID, questionID uuid.UUID) error {
	existing, err := u.questionRepo.GetByID(ctx, questionID)
	if err != nil {
		return err
	}
	if existing == nil || existing.QuizID != quizID {
		return domainErrors.ErrNotFound
	}
	return u.questionRepo.Delete(ctx, questionID)
}

// GetByID retrieves a question by primary key.
func (u *quizQuestionUseCase) GetByID(ctx context.Context, questionID uuid.UUID) (*entities.QuizQuestion, error) {
	q, err := u.questionRepo.GetByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	if q == nil {
		return nil, domainErrors.ErrNotFound
	}
	return q, nil
}

// ListByQuizID returns all questions for a quiz ordered by position.
func (u *quizQuestionUseCase) ListByQuizID(ctx context.Context, quizID uuid.UUID) ([]*entities.QuizQuestion, error) {
	return u.questionRepo.List(ctx, repo.QuizQuestionFilter{QuizID: &quizID})
}

// ReplaceQuestions makes the quiz's questions match the given slice exactly.
//
// Every question is validated before anything is written, so a quiz with one
// bad question is rejected whole rather than saved up to the point of failure.
func (u *quizQuestionUseCase) ReplaceQuestions(ctx context.Context, quizID uuid.UUID, questions []*entities.QuizQuestion) error {
	quiz, err := u.quizRepo.GetByID(ctx, quizID)
	if err != nil {
		return err
	}
	// A bare errors.New here would fall through respondError to a 500.
	if quiz == nil {
		return domainErrors.ErrNotFound
	}

	for i, question := range questions {
		if question == nil {
			return errors.New("question list contains an empty entry")
		}
		question.QuizID = quizID
		// Position comes from the order of the slice. It also starts at 1
		// rather than 0 — see D5: `Position int` is tagged binding:"required",
		// and Go's validator treats 0 as absent.
		question.Position = i + 1

		if err := question.IsValid(); err != nil {
			return err
		}
	}

	return u.questionRepo.ReplaceByQuizID(ctx, quizID, questions)
}
