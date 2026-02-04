package enums

// FormStatus represents the lifecycle state of a form
type FormStatus int

const (
	// FormStatusDraft means the form is still being prepared
	FormStatusDraft FormStatus = iota

	// FormStatusActive means the form is published and accepting responses
	FormStatusActive

	// FormStatusClosed means the form is no longer accepting responses
	FormStatusClosed
)

// IsValid checks if the FormStatus value is valid
func (fs FormStatus) IsValid() bool {
	switch fs {
	case FormStatusDraft, FormStatusActive, FormStatusClosed:
		return true
	default:
		return false
	}
}

// CanAcceptResponses checks business rule
func (fs FormStatus) CanAcceptResponses() bool {
	return fs == FormStatusActive
}
