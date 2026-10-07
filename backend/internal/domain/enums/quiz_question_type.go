package enums

// QuizQuestionType represents the type of a quiz question
type QuizQuestionType string

const (
	// QuizQuestionTypeMCQ is a multiple-choice question with one correct option
	QuizQuestionTypeMCQ QuizQuestionType = "mcq"
	// QuizQuestionTypeTF is a True/False question
	QuizQuestionTypeTF QuizQuestionType = "tf"
	// QuizQuestionTypeShort is a short-answer (fill-in-the-blank) question
	QuizQuestionTypeShort QuizQuestionType = "short"
)

// IsValid checks if the QuizQuestionType is an allowed value
func (qt QuizQuestionType) IsValid() bool {
	switch qt {
	case QuizQuestionTypeMCQ, QuizQuestionTypeTF, QuizQuestionTypeShort:
		return true
	default:
		return false
	}
}
