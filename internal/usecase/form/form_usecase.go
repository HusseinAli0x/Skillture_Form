package form

import (
	"context"
	"errors"
	"time"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	repo "Skillture_Form/internal/repository/interfaces"
	formUC "Skillture_Form/internal/usecase/interfaces"

	"github.com/google/uuid"
)

// formUseCase is the concrete implementation of FormUseCase.
type formUseCase struct {
	formRepo repo.FormRepository
}

// NewFormUseCase creates a new FormUseCase instance.
// Dependencies are injected to keep the use case clean and testable.
func NewFormUseCase(
	formRepo repo.FormRepository,
) formUC.FormUseCase {
	return &formUseCase{formRepo: formRepo}
}

// Create creates a new form.
// This use case only handles form metadata, not fields.
func (u *formUseCase) Create(ctx context.Context, form *entities.Form) error {

	// Validate form title
	if len(form.Title) == 0 {
		return errors.New("form title is required")
	}

	// Generate a new UUID if not provided
	if form.ID == uuid.Nil {
		form.ID = uuid.New()
	}

	// Set default status
	form.Status = enums.FormStatusDraft

	// Set creation time
	form.CreatedAt = time.Now()

	// Persist the form
	return u.formRepo.Create(ctx, form)
}

// Update updates an existing form.
func (u *formUseCase) Update(ctx context.Context, form *entities.Form) error {

	// Ensure the form exists
	existing, err := u.formRepo.GetByID(ctx, form.ID)
	if err != nil {
		return err
	}

	// Closed forms cannot be updated
	if existing.Status == enums.FormStatusClosed {
		return errors.New("closed form cannot be updated")
	}

	// Validate updated data
	if len(form.Title) == 0 {
		return errors.New("form title is required")
	}

	// Preserve immutable fields
	form.CreatedAt = existing.CreatedAt
	form.Status = existing.Status

	// Persist changes
	return u.formRepo.Update(ctx, form)
}

// Publish changes form status from Draft to Published.
func (u *formUseCase) Publish(ctx context.Context, formID uuid.UUID) error {

	// Retrieve the form
	form, err := u.formRepo.GetByID(ctx, formID)
	if err != nil {
		return err
	}

	// Only draft forms can be published
	if form.Status != enums.FormStatusDraft {
		return errors.New("only draft forms can be published")
	}

	// Change status to Published
	form.Status = enums.FormStatusPublished

	// Persist status change
	return u.formRepo.Update(ctx, form)
}

// Close closes a form and prevents new responses.
func (u *formUseCase) Close(ctx context.Context, formID uuid.UUID) error {

	// Retrieve the form
	form, err := u.formRepo.GetByID(ctx, formID)
	if err != nil {
		return err
	}

	// If already closed, do nothing
	if form.Status == enums.FormStatusClosed {
		return nil
	}

	// Change status to Closed
	form.Status = enums.FormStatusClosed

	// Persist status change
	return u.formRepo.Update(ctx, form)
}

// Delete deletes a form.
// Deletion is allowed even if the form has responses.
func (u *formUseCase) Delete(ctx context.Context, formID uuid.UUID) error {

	// Ensure the form exists
	_, err := u.formRepo.GetByID(ctx, formID)
	if err != nil {
		return err
	}

	// Delete the form
	return u.formRepo.Delete(ctx, formID)
}

// GetByID retrieves a form by its ID.
func (u *formUseCase) GetByID(ctx context.Context, formID uuid.UUID) (*entities.Form, error) {

	return u.formRepo.GetByID(ctx, formID)
}

// List retrieves all forms.
func (u *formUseCase) List(ctx context.Context) ([]*entities.Form, error) {
	return u.formRepo.List(ctx, repo.FormFilter{})
}
