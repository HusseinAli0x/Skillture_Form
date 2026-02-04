package enums

type FormStatus int16

const (
	FormStatusDraft     FormStatus = 0
	FormStatusPublished FormStatus = 1
	FormStatusClosed    FormStatus = 2
)

// IsValid validates the enum value
func (fs FormStatus) IsValid() bool {
	switch fs {
	case FormStatusDraft, FormStatusPublished, FormStatusClosed:
		return true
	}
	return false
}
