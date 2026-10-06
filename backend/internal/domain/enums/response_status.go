package enums

// ResponseStatus represents the status of a form submission
type ResponseStatus int

const (
	// ResponsePending means the submission is not yet finalized
	ResponsePending ResponseStatus = iota

	// ResponseSubmitted means the submission is completed
	ResponseSubmitted

	// ResponseReviewed means the submission has been reviewed by admin
	ResponseReviewed
)

// IsValid checks if the ResponseStatus is allowed
func (rs ResponseStatus) IsValid() bool {
	switch rs {
	case ResponsePending, ResponseSubmitted, ResponseReviewed:
		return true
	default:
		return false
	}
}
