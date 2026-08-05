package form_field

import (
	"context"
	"errors"
	"time"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"
	uc "skillture/backend/internal/usecase/interfaces"
	val "skillture/backend/internal/validation"

	"github.com/google/uuid"
)

// formFieldUseCase implements the FormFieldUseCase interface
type formFieldUseCase struct {
	formRepo      repo.FormRepository
	formFieldRepo repo.FormFieldRepository
}

// NewFormFieldUseCase creates a new instance of formFieldUseCase
func NewFormFieldUseCase(
	formRepo repo.FormRepository,
	formFieldRepo repo.FormFieldRepository,
) uc.FormFieldUseCase {
	return &formFieldUseCase{
		formRepo:      formRepo,
		formFieldRepo: formFieldRepo,
	}
}

// Create adds a new field to a form with domain validation
func (u *formFieldUseCase) Create(ctx context.Context, field *entities.FormField) error {

	// -------------------
	//  Domain validation
	// -------------------
	if err := val.ValidateFormFieldDomain(field); err != nil {
		return err
	}

	// -------------------
	// Business rules
	// -------------------
	form, err := u.formRepo.GetByID(ctx, field.FormID)
	if err != nil {
		return err
	}
	// Repositories signal "not found" as (nil, nil).
	if form == nil {
		return domainErrors.ErrNotFound
	}
	if form.Status == enums.FormStatusClosed {
		return errors.New("cannot add field to a closed form")
	}

	// -------------------
	// Defaults & timestamps
	// -------------------
	if field.ID == uuid.Nil {
		field.ID = uuid.New()
	}
	field.CreatedAt = time.Now()
	field.UpdatedAt = time.Now()

	// -------------------
	//  Persist
	// -------------------
	return u.formFieldRepo.Create(ctx, field)
}

// Update updates an existing form field
func (u *formFieldUseCase) Update(ctx context.Context, field *entities.FormField) error {

	// -------------------
	//  Load existing
	// -------------------
	existing, err := u.formFieldRepo.GetByID(ctx, field.ID)
	if err != nil {
		return err
	}
	// GetByID returns (nil, nil) for a missing row. Without this the
	// existing.FormID dereference below panicked on any unknown field ID.
	if existing == nil {
		return domainErrors.ErrNotFound
	}

	// -------------------
	//  Domain validation
	// -------------------
	if err := val.ValidateFormFieldDomain(field); err != nil {
		return err
	}

	// -------------------
	//  Business rules
	// -------------------
	form, err := u.formRepo.GetByID(ctx, existing.FormID)
	if err != nil {
		return err
	}
	if form == nil {
		return domainErrors.ErrNotFound
	}
	if form.Status == enums.FormStatusClosed {
		return errors.New("cannot update field of a closed form")
	}

	// Preserve immutable fields
	field.FormID = existing.FormID
	field.CreatedAt = existing.CreatedAt
	field.UpdatedAt = time.Now()

	// -------------------
	//  Persist
	// -------------------
	return u.formFieldRepo.Update(ctx, field)
}

// Delete removes a form field
func (u *formFieldUseCase) Delete(ctx context.Context, fieldID uuid.UUID) error {

	// Ensure field exists
	existing, err := u.formFieldRepo.GetByID(ctx, fieldID)
	if err != nil {
		return err
	}
	if existing == nil {
		return domainErrors.ErrNotFound
	}

	// Delete
	return u.formFieldRepo.Delete(ctx, fieldID)
}

// ListByFormID returns all fields of a form
func (u *formFieldUseCase) ListByFormID(ctx context.Context, formID uuid.UUID) ([]*entities.FormField, error) {
	return u.formFieldRepo.List(ctx, repo.FormFieldFilter{FormID: &formID})
}
