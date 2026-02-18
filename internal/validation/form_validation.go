package validation

import (
	"errors"

	"Skillture_Form/internal/domain/entities"
)

// Errors
var (
	ErrInvalidFormStatus     = errors.New("invalid form status")
	ErrFormTitleRequired     = errors.New("form title is required")
	ErrFormDescriptionNeeded = errors.New("form description is required")
)

// ValidateFormDomain validates the Form entity
func ValidateFormDomain(f *entities.Form) error {
	if f.Title == "" {
		return ErrFormTitleRequired
	}

	if f.Description == "" {
		return ErrFormDescriptionNeeded
	}

	if !f.Status.IsValid() {
		return ErrInvalidFormStatus
	}

	return nil
}
