package validation

import (
	"errors"

	"skillture/backend/internal/domain/entities"
)

// Errors
var (
	ErrInvalidFormStatus     = errors.New("invalid form status")
	ErrFormTitleRequired     = errors.New("form title is required")
	ErrFormDescriptionNeeded = errors.New("form description is required")
)

// ValidateFormDomain validates the Form entity
func ValidateFormDomain(f *entities.Form) error {
	if len(f.Title) == 0 {
		return ErrFormTitleRequired
	}

	if len(f.Description) == 0 {
		return ErrFormDescriptionNeeded
	}

	if !f.Status.IsValid() {
		return ErrInvalidFormStatus
	}

	return nil
}
