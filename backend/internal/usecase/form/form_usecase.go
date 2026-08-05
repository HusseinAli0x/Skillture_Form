package form

import (
	"context"
	"errors"
	"time"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"
	formUC "skillture/backend/internal/usecase/interfaces"

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
	// Repositories signal "not found" as (nil, nil).
	if existing == nil {
		return domainErrors.ErrNotFound
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
	if form == nil {
		return domainErrors.ErrNotFound
	}

	// Already published: nothing to do, and a repeated PATCH should not fail.
	if form.Status == enums.FormStatusPublished {
		return nil
	}

	// Draft -> Published is the normal path; Closed -> Published reopens a
	// form for responses. This used to reject anything but Draft, which left
	// no way back from Closed at all — so the UI reached around the state
	// machine and forced the status through the untyped PUT instead.
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
	if form == nil {
		return domainErrors.ErrNotFound
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
	existing, err := u.formRepo.GetByID(ctx, formID)
	if err != nil {
		return err
	}
	if existing == nil {
		return domainErrors.ErrNotFound
	}

	// Delete the form
	return u.formRepo.Delete(ctx, formID)
}

// GetByID retrieves a form by its ID.
func (u *formUseCase) GetByID(ctx context.Context, formID uuid.UUID) (*entities.Form, error) {

	return u.formRepo.GetByID(ctx, formID)
}

// List returns forms based on filter.
func (u *formUseCase) List(ctx context.Context, filter formUC.FormFilter) ([]*entities.Form, error) {
	// Map the usecase filter to the repository filter if needed, or pass directly
	// For now, assuming the repository filter is similar. Let's build a repo filter.
	repoFilter := repo.FormFilter{
		Status: filter.Status,
		Title:  filter.Title,
	}
	return u.formRepo.List(ctx, repoFilter)
}
