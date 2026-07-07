package enums

// QuizSessionStatus represents the real-time lifecycle state of a live game session
type QuizSessionStatus string

const (
	// QuizSessionStatusLobby means the session PIN is active and players can join
	QuizSessionStatusLobby QuizSessionStatus = "lobby"
	// QuizSessionStatusActive means the host has started the game and questions are in progress
	QuizSessionStatusActive QuizSessionStatus = "active"
	// QuizSessionStatusFinished means all questions are done and the final leaderboard is shown
	QuizSessionStatusFinished QuizSessionStatus = "finished"
)

// IsValid checks if the QuizSessionStatus is an allowed value
func (ss QuizSessionStatus) IsValid() bool {
	switch ss {
	case QuizSessionStatusLobby, QuizSessionStatusActive, QuizSessionStatusFinished:
		return true
	default:
		return false
	}
}
