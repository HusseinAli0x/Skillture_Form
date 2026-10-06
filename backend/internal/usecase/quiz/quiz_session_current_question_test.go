package quiz

import (
	"context"
	"testing"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"

	"github.com/google/uuid"
)

// A reconnecting player is resynced with the live question, so the use case
// must return it only while the session is active and has one.
func TestCurrentQuestion(t *testing.T) {
	qid := uuid.New()
	question := &entities.QuizQuestion{ID: qid, Question: map[string]string{"en": "Q"}}
	questions := &ownedQuestionRepo{question: question}
	uc := &quizSessionUseCase{questionRepo: questions}

	cases := []struct {
		name    string
		session *entities.QuizSession
		want    bool
	}{
		{"nil session", nil, false},
		{"lobby", &entities.QuizSession{Status: enums.QuizSessionStatusLobby, CurrentQuestionID: &qid}, false},
		{"active without a question", &entities.QuizSession{Status: enums.QuizSessionStatusActive}, false},
		{"finished", &entities.QuizSession{Status: enums.QuizSessionStatusFinished, CurrentQuestionID: &qid}, false},
		{"active with a question", &entities.QuizSession{Status: enums.QuizSessionStatusActive, CurrentQuestionID: &qid}, true},
	}
	for _, c := range cases {
		got, err := uc.CurrentQuestion(context.Background(), c.session)
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if (got != nil) != c.want {
			t.Errorf("%s: got question %v, want present=%v", c.name, got, c.want)
		}
	}
}
