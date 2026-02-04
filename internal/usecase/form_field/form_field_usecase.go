package form_field

import (
	"context"
	"errors"
	"time"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	repo "Skillture_Form/internal/repository/interfaces"
	uc "Skillture_Form/internal/usecase/interfaces"

	"github.com/google/uuid"
)

// formFieldUseCase is the concrete implementation of FormFieldUseCase.
type formFieldUseCase struct {
	formRepo      repo.FormRepository
	formFieldRepo repo.FormFieldRepository
}

// NewFormFieldUseCase creates a new FormFieldUseCase.
// Repositories are injected to follow dependency inversion.
func NewFormFieldUseCase(
	formRepo repo.FormRepository,
	formFieldRepo repo.FormFieldRepository,
) uc.FormFieldUseCase {
	return &formFieldUseCase{
		formRepo:      formRepo,
		formFieldRepo: formFieldRepo,
	}
}

// Create adds a new field to a form.
func (u *formFieldUseCase) Create(ctx context.Context, field *entities.FormField) error {

	// Ensure the parent form exists
	form, err := u.formRepo.GetByID(ctx, field.FormID)
	if err != nil {
		return err
	}

	// Business rule: cannot add fields to a closed form
	if form.Status == enums.FormStatusClosed {
		return errors.New("cannot add field to a closed form")
	}

	// Generate ID if not provided
	if field.ID == uuid.Nil {
		field.ID = uuid.New()
	}

	// Validate required field properties
	if !field.Type.IsValid() {
		return errors.New("field type is required")
	}

	if field.FieldOrder <= 0 {
		return errors.New("field position must be greater than zero")
	}

	// Set timestamps
	field.CreatedAt = time.Now()
	field.UpdatedAt = time.Now()

	// Persist the field
	return u.formFieldRepo.Create(ctx, field)
}

// Update updates an existing form field.
func (u *formFieldUseCase) Update(ctx context.Context, field *entities.FormField) error {

	// Load existing field
	existing, err := u.formFieldRepo.GetByID(ctx, field.ID)
	if err != nil {
		return err
	}

	// Ensure the parent form is not closed
	form, err := u.formRepo.GetByID(ctx, existing.FormID)
	if err != nil {
		return err
	}

	if form.Status == enums.FormStatusClosed {
		return errors.New("cannot update field of a closed form")
	}

	// Preserve immutable fields
	field.FormID = existing.FormID
	field.CreatedAt = existing.CreatedAt

	// Update timestamp
	field.UpdatedAt = time.Now()

	// Persist changes
	return u.formFieldRepo.Update(ctx, field)
}

// Delete removes a form field.
func (u *formFieldUseCase) Delete(ctx context.Context, fieldID uuid.UUID) error {

	// Ensure the field exists
	_, err := u.formFieldRepo.GetByID(ctx, fieldID)
	if err != nil {
		return err
	}

	// Delete the field
	return u.formFieldRepo.Delete(ctx, fieldID)
}

// ListByFormID returns all fields for a specific form ordered by position.
func (u *formFieldUseCase) ListByFormID(
	ctx context.Context,
	formID uuid.UUID,
) ([]*entities.FormField, error) {

	return u.formFieldRepo.List(ctx, repo.FormFieldFilter{
		FormID: &formID,
	})
}
