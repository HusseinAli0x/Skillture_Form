package enums

// QuizStatus represents the lifecycle state of a quiz
type QuizStatus int16

const (
	QuizStatusDraft    QuizStatus = 0 // Being created, not visible to players
	QuizStatusActive   QuizStatus = 1 // Published and ready to be hosted
	QuizStatusArchived QuizStatus = 2 // Retired, no new sessions allowed
)

// IsValid checks if the QuizStatus is an allowed value
func (qs QuizStatus) IsValid() bool {
	switch qs {
	case QuizStatusDraft, QuizStatusActive, QuizStatusArchived:
		return true
	}
	return false
}
