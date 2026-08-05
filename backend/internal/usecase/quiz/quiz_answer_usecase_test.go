package quiz

import (
	"testing"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
)

func TestClampTimeTaken(t *testing.T) {
	tests := []struct {
		name         string
		timeTakenMs  int
		timeLimitSec int
		want         int
	}{
		{"normal answer is untouched", 3_000, 10, 3_000},
		{"instant answer", 0, 10, 0},
		{"negative time is floored at zero", -999_999, 10, 0},
		{"overrun is capped at the limit", 25_000, 10, 10_000},
		{"exactly on the limit", 10_000, 10, 10_000},
		{"no time limit leaves the value alone", 42, 0, 42},
		{"no time limit still floors negatives", -42, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := clampTimeTaken(tt.timeTakenMs, tt.timeLimitSec); got != tt.want {
				t.Errorf("clampTimeTaken(%d, %d) = %d, want %d",
					tt.timeTakenMs, tt.timeLimitSec, got, tt.want)
			}
		})
	}
}

// A player controls time_taken_ms, so no value they can send may ever earn more
// than the question's base points.
func TestScoreNeverExceedsBasePoints(t *testing.T) {
	const basePoints, timeLimitSec = 1000, 10

	for _, submitted := range []int{-999_999_999, -1, 0, 1, 5_000, 10_000, 999_999_999} {
		clamped := clampTimeTaken(submitted, timeLimitSec)
		score := calculateScore(basePoints, timeLimitSec, clamped)

		if score > basePoints {
			t.Errorf("time_taken_ms=%d produced score %d, above base points %d",
				submitted, score, basePoints)
		}
		if score < basePoints/2 {
			t.Errorf("time_taken_ms=%d produced score %d, below the %d floor for a correct answer",
				submitted, score, basePoints/2)
		}
	}
}

func TestCalculateScore(t *testing.T) {
	tests := []struct {
		name         string
		basePoints   int
		timeLimitSec int
		timeTakenMs  int
		want         int
	}{
		{"instant answer earns full points", 1000, 10, 0, 1000},
		{"halfway through earns 75%", 1000, 10, 5_000, 750},
		{"on the buzzer earns the 50% floor", 1000, 10, 10_000, 500},
		{"past the buzzer still earns the floor", 1000, 10, 20_000, 500},
		{"no time limit earns full points", 1000, 0, 5_000, 1000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := calculateScore(tt.basePoints, tt.timeLimitSec, tt.timeTakenMs); got != tt.want {
				t.Errorf("calculateScore(%d, %d, %d) = %d, want %d",
					tt.basePoints, tt.timeLimitSec, tt.timeTakenMs, got, tt.want)
			}
		})
	}
}

func TestCheckAnswer(t *testing.T) {
	tests := []struct {
		name     string
		question *entities.QuizQuestion
		answer   map[string]any
		want     bool
	}{
		{
			name: "mcq matching value",
			question: &entities.QuizQuestion{
				Type:          enums.QuizQuestionTypeMCQ,
				CorrectAnswer: map[string]any{"value": "Go"},
			},
			answer: map[string]any{"value": "Go"},
			want:   true,
		},
		{
			name: "mcq wrong value",
			question: &entities.QuizQuestion{
				Type:          enums.QuizQuestionTypeMCQ,
				CorrectAnswer: map[string]any{"value": "Go"},
			},
			answer: map[string]any{"value": "Rust"},
			want:   false,
		},
		{
			name: "true/false compares across bool and string encodings",
			question: &entities.QuizQuestion{
				Type:          enums.QuizQuestionTypeTF,
				CorrectAnswer: map[string]any{"value": true},
			},
			answer: map[string]any{"value": "true"},
			want:   true,
		},
		{
			name: "short answer ignores case and surrounding space",
			question: &entities.QuizQuestion{
				Type:          enums.QuizQuestionTypeShort,
				CorrectAnswer: map[string]any{"text": "Goroutine"},
			},
			answer: map[string]any{"text": "  goroutine "},
			want:   true,
		},
		{
			name: "empty answer is never correct",
			question: &entities.QuizQuestion{
				Type:          enums.QuizQuestionTypeMCQ,
				CorrectAnswer: map[string]any{"value": "Go"},
			},
			answer: map[string]any{},
			want:   false,
		},
		{
			name: "answer under the wrong key is not correct",
			question: &entities.QuizQuestion{
				Type:          enums.QuizQuestionTypeMCQ,
				CorrectAnswer: map[string]any{"value": "Go"},
			},
			answer: map[string]any{"text": "Go"},
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := checkAnswer(tt.question, tt.answer); got != tt.want {
				t.Errorf("checkAnswer() = %v, want %v", got, tt.want)
			}
		})
	}
}
