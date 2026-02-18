package validation

import (
	"errors"

	"Skillture_Form/internal/domain/entities"
)

// Errors
var (
	ErrInvalidFieldType  = errors.New("invalid field type")
	ErrMissingOptions    = errors.New("options are required for select, radio, or checkbox fields")
	ErrInvalidFieldOrder = errors.New("field order must be greater than zero")
)

// ValidateFormFieldDomain validates FormField entity
func ValidateFormFieldDomain(ff *entities.FormField) error {

	if !ff.Type.IsValid() {
		return ErrInvalidFieldType
	}

	// Ensure required options exist for select/radio/checkbox
	if ff.RequiresOptions() && len(ff.Options) == 0 {
		return ErrMissingOptions
	}

	if ff.FieldOrder <= 0 {
		return ErrInvalidFieldOrder
	}

	// All validations passed
	return nil
}
