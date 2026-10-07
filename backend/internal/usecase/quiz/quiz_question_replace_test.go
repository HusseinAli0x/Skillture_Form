package quiz

import (
	"context"
	"errors"
	"testing"
	"time"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
)

// ---- Fakes ---------------------------------------------------------------
//
// ReplaceQuestions is the ordering and validation gate in front of the
// transactional repository write, so these fakes only record what the use case
// decided to hand over.

type fakeQuizRepo struct {
	quiz *entities.Quiz
	err  error
}

func (f *fakeQuizRepo) GetByID(context.Context, uuid.UUID) (*entities.Quiz, error) {
	return f.quiz, f.err
}
func (f *fakeQuizRepo) Create(context.Context, *entities.Quiz) error { return nil }
func (f *fakeQuizRepo) Update(context.Context, *entities.Quiz) error { return nil }
func (f *fakeQuizRepo) Delete(context.Context, uuid.UUID) error      { return nil }
func (f *fakeQuizRepo) List(context.Context, repo.QuizFilter) ([]*entities.Quiz, error) {
	return nil, nil
}
func (f *fakeQuizRepo) CountByOwner(context.Context, string) (int, error) { return 0, nil }
func (f *fakeQuizRepo) DeleteStaleVisitorQuizzes(context.Context, time.Time) (int64, error) {
	return 0, nil
}

type fakeQuestionRepo struct {
	replaced []*entities.QuizQuestion
	calls    int
}

func (f *fakeQuestionRepo) ReplaceByQuizID(_ context.Context, _ uuid.UUID, questions []*entities.QuizQuestion) error {
	f.calls++
	f.replaced = questions
	return nil
}
func (f *fakeQuestionRepo) Create(context.Context, *entities.QuizQuestion) error { return nil }
func (f *fakeQuestionRepo) Update(context.Context, *entities.QuizQuestion) error { return nil }
func (f *fakeQuestionRepo) Delete(context.Context, uuid.UUID) error              { return nil }
func (f *fakeQuestionRepo) GetByID(context.Context, uuid.UUID) (*entities.QuizQuestion, error) {
	return nil, nil
}
func (f *fakeQuestionRepo) List(context.Context, repo.QuizQuestionFilter) ([]*entities.QuizQuestion, error) {
	return nil, nil
}

func shortQuestion(text string) *entities.QuizQuestion {
	return &entities.QuizQuestion{
		Question:      map[string]string{"en": text},
		Type:          enums.QuizQuestionTypeShort,
		TimeLimitSec:  15,
		Points:        1000,
		CorrectAnswer: map[string]any{"value": "42"},
	}
}

// ---- Tests ---------------------------------------------------------------

func TestReplaceQuestionsAssignsPositionFromSliceOrder(t *testing.T) {
	quizID := uuid.New()
	questionRepo := &fakeQuestionRepo{}
	uc := NewQuizQuestionUseCase(&fakeQuizRepo{quiz: &entities.Quiz{ID: quizID}}, questionRepo)

	questions := []*entities.QuizQuestion{
		shortQuestion("first"),
		shortQuestion("second"),
		shortQuestion("third"),
	}
	questions[0].Position = 77 // contradicts the slice order on purpose

	if err := uc.ReplaceQuestions(context.Background(), quizID, questions); err != nil {
		t.Fatalf("ReplaceQuestions: %v", err)
	}

	for i, question := range questionRepo.replaced {
		// Positions start at 1, not 0 — see D5: `Position int` is tagged
		// binding:"required" and Go's validator reads 0 as absent.
		if want := i + 1; question.Position != want {
			t.Errorf("question %d: Position = %d, want %d", i, question.Position, want)
		}
		if question.QuizID != quizID {
			t.Errorf("question %d: QuizID = %s, want %s", i, question.QuizID, quizID)
		}
	}
}

func TestReplaceQuestionsRejectsBeforeWriting(t *testing.T) {
	quizID := uuid.New()
	questionRepo := &fakeQuestionRepo{}
	uc := NewQuizQuestionUseCase(&fakeQuizRepo{quiz: &entities.Quiz{ID: quizID}}, questionRepo)

	// An MCQ with no options fails entities.QuizQuestion.IsValid. The whole
	// save must be refused rather than written up to the point of failure.
	bad := shortQuestion("pick one")
	bad.Type = enums.QuizQuestionTypeMCQ

	err := uc.ReplaceQuestions(context.Background(), quizID, []*entities.QuizQuestion{
		shortQuestion("ok"),
		bad,
	})
	if err == nil {
		t.Fatal("ReplaceQuestions accepted an MCQ with no options")
	}
	if questionRepo.calls != 0 {
		t.Errorf("repository was called %d times despite validation failing", questionRepo.calls)
	}
}

func TestReplaceQuestionsOnMissingQuiz(t *testing.T) {
	questionRepo := &fakeQuestionRepo{}
	// Repositories signal "not found" as (nil, nil).
	uc := NewQuizQuestionUseCase(&fakeQuizRepo{quiz: nil}, questionRepo)

	err := uc.ReplaceQuestions(context.Background(), uuid.New(), []*entities.QuizQuestion{
		shortQuestion("a"),
	})
	// Must be the mapped domain error: a bare errors.New falls through
	// respondError to a 500 rather than the 404 this is.
	if !errors.Is(err, domainErrors.ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
	if questionRepo.calls != 0 {
		t.Errorf("repository was called %d times for a quiz that does not exist", questionRepo.calls)
	}
}
