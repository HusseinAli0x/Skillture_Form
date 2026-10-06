package quiz

import (
	"testing"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
)

func TestCheckAnswerShort(t *testing.T) {
	// The quiz builder stores a short question's right answer under "value";
	// an older shape used "text". Both must score, and neither used to.
	tests := []struct {
		name      string
		correct   map[string]any
		submitted map[string]any
		want      bool
	}{
		{"builder shape, text submitted", map[string]any{"value": "Cairo"}, map[string]any{"text": "Cairo"}, true},
		{"builder shape, value submitted", map[string]any{"value": "Cairo"}, map[string]any{"value": "Cairo"}, true},
		{"legacy text shape", map[string]any{"text": "Cairo"}, map[string]any{"text": "Cairo"}, true},
		{"ignores case", map[string]any{"value": "Cairo"}, map[string]any{"text": "cAiRo"}, true},
		{"ignores surrounding and repeated spaces", map[string]any{"value": "New  York"}, map[string]any{"text": "  new york "}, true},
		{"arabic answer", map[string]any{"value": "القاهرة"}, map[string]any{"text": " القاهرة "}, true},
		{"wrong answer", map[string]any{"value": "Cairo"}, map[string]any{"text": "Alexandria"}, false},
		{"empty submission", map[string]any{"value": "Cairo"}, map[string]any{"text": "   "}, false},
		{"no stored answer", map[string]any{}, map[string]any{"text": "Cairo"}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := &entities.QuizQuestion{Type: enums.QuizQuestionTypeShort, CorrectAnswer: tt.correct}
			if got := checkAnswer(q, tt.submitted); got != tt.want {
				t.Fatalf("checkAnswer = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCheckAnswerChoice(t *testing.T) {
	q := &entities.QuizQuestion{Type: enums.QuizQuestionTypeMCQ, CorrectAnswer: map[string]any{"value": "4"}}
	if !checkAnswer(q, map[string]any{"value": "4"}) {
		t.Fatal("the right option should score")
	}
	if checkAnswer(q, map[string]any{"value": "3"}) {
		t.Fatal("a wrong option should not score")
	}
	if checkAnswer(q, map[string]any{}) {
		t.Fatal("an empty answer should not score")
	}
}

func TestCorrectStreak(t *testing.T) {
	ans := func(correct ...bool) []*entities.QuizPlayerAnswer {
		out := make([]*entities.QuizPlayerAnswer, len(correct))
		for i, c := range correct {
			out[i] = &entities.QuizPlayerAnswer{IsCorrect: c}
		}
		return out
	}
	tests := []struct {
		name string
		hist []*entities.QuizPlayerAnswer
		want int
	}{
		{"no history", nil, 0},
		{"all correct", ans(true, true, true), 3},
		{"wrong most recently", ans(true, true, false), 0},
		{"streak after a miss", ans(true, false, true, true), 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := correctStreak(tt.hist); got != tt.want {
				t.Fatalf("correctStreak = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestStreakBonusFor(t *testing.T) {
	tests := []struct{ base, streak, want int }{
		{1000, 0, 0},
		{1000, 1, 0},   // the first correct answer earns no bonus
		{1000, 2, 100}, // +10%
		{1000, 3, 200},
		{1000, 6, 500},  // capped at +50%
		{1000, 40, 500}, // and stays capped
		{500, 3, 100},
	}
	for _, tt := range tests {
		if got := streakBonusFor(tt.base, tt.streak); got != tt.want {
			t.Errorf("streakBonusFor(%d, %d) = %d, want %d", tt.base, tt.streak, got, tt.want)
		}
	}
}
