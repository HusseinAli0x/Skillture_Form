package quiz

import (
	"context"
	"errors"
	"testing"

	"skillture/backend/internal/domain/entities"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
)

// ownedQuestionRepo returns one question that belongs to ownerQuizID and
// records whether the write methods were reached.
type ownedQuestionRepo struct {
	fakeQuestionRepo
	question *entities.QuizQuestion
	updated  bool
	deleted  bool
	listed   []*entities.QuizQuestion
}

func (r *ownedQuestionRepo) GetByID(context.Context, uuid.UUID) (*entities.QuizQuestion, error) {
	return r.question, nil
}
func (r *ownedQuestionRepo) Update(context.Context, *entities.QuizQuestion) error {
	r.updated = true
	return nil
}
func (r *ownedQuestionRepo) Delete(context.Context, uuid.UUID) error {
	r.deleted = true
	return nil
}
func (r *ownedQuestionRepo) Create(_ context.Context, q *entities.QuizQuestion) error {
	r.question = q
	return nil
}
func (r *ownedQuestionRepo) List(context.Context, repo.QuizQuestionFilter) ([]*entities.QuizQuestion, error) {
	return r.listed, nil
}

func TestUpdateRejectsAQuestionFromAnotherQuiz(t *testing.T) {
	ownerQuizID := uuid.New()
	attackerQuizID := uuid.New()
	questionID := uuid.New()

	questionRepo := &ownedQuestionRepo{
		question: &entities.QuizQuestion{ID: questionID, QuizID: ownerQuizID},
	}
	uc := NewQuizQuestionUseCase(&fakeQuizRepo{quiz: &entities.Quiz{ID: attackerQuizID}}, questionRepo)

	// PUT /quizzes/{attacker}/questions/{someone-elses-question}. The handler
	// used to read only :qid and ignore :id, so this rewrote the question.
	err := uc.Update(context.Background(), attackerQuizID, &entities.QuizQuestion{
		ID:       questionID,
		Question: map[string]string{"en": "rewritten"},
	})

	// Not-found, not forbidden: a caller poking at ids should not learn that
	// the question exists under a different quiz.
	if !errors.Is(err, domainErrors.ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
	if questionRepo.updated {
		t.Error("the question was rewritten despite belonging to another quiz")
	}
}

func TestDeleteRejectsAQuestionFromAnotherQuiz(t *testing.T) {
	ownerQuizID := uuid.New()
	attackerQuizID := uuid.New()
	questionID := uuid.New()

	questionRepo := &ownedQuestionRepo{
		question: &entities.QuizQuestion{ID: questionID, QuizID: ownerQuizID},
	}
	uc := NewQuizQuestionUseCase(&fakeQuizRepo{quiz: &entities.Quiz{ID: attackerQuizID}}, questionRepo)

	err := uc.Delete(context.Background(), attackerQuizID, questionID)

	if !errors.Is(err, domainErrors.ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
	if questionRepo.deleted {
		t.Error("the question was deleted despite belonging to another quiz")
	}
}

func TestUpdateAcceptsAQuestionInItsOwnQuiz(t *testing.T) {
	quizID := uuid.New()
	questionID := uuid.New()

	questionRepo := &ownedQuestionRepo{
		question: &entities.QuizQuestion{ID: questionID, QuizID: quizID},
	}
	uc := NewQuizQuestionUseCase(&fakeQuizRepo{quiz: &entities.Quiz{ID: quizID}}, questionRepo)

	valid := shortQuestion("still fine")
	valid.ID = questionID

	if err := uc.Update(context.Background(), quizID, valid); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if !questionRepo.updated {
		t.Error("a question in its own quiz was not updated")
	}
}

func TestCreateAppendsWhenPositionIsAbsent(t *testing.T) {
	quizID := uuid.New()

	// `Position int` was tagged binding:"required", and Go's validator reads 0
	// as absent — so position 0 was rejected outright and positions had to
	// start at 1 by accident. Absent now means "append".
	questionRepo := &ownedQuestionRepo{
		listed: []*entities.QuizQuestion{{ID: uuid.New()}, {ID: uuid.New()}},
	}
	uc := NewQuizQuestionUseCase(&fakeQuizRepo{quiz: &entities.Quiz{ID: quizID}}, questionRepo)

	question := shortQuestion("appended")
	question.QuizID = quizID
	question.Position = 0

	if err := uc.Create(context.Background(), question); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if question.Position != 3 {
		t.Errorf("Position = %d, want 3 (two existing questions plus one)", question.Position)
	}
}

func TestCreateKeepsAnExplicitPosition(t *testing.T) {
	quizID := uuid.New()
	questionRepo := &ownedQuestionRepo{}
	uc := NewQuizQuestionUseCase(&fakeQuizRepo{quiz: &entities.Quiz{ID: quizID}}, questionRepo)

	question := shortQuestion("second")
	question.QuizID = quizID
	question.Position = 2

	if err := uc.Create(context.Background(), question); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if question.Position != 2 {
		t.Errorf("Position = %d, want the requested 2", question.Position)
	}
}
