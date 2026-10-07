package interfaces

import (
	"context"
	"skillture/backend/internal/domain/entities"

	"github.com/google/uuid"
)

// Filter object for listing form fields
type FormFieldFilter struct {
	FormID *uuid.UUID // optional: if set, list only fields of this form
}

// FormFieldRepository defines CRUD for form fields
type FormFieldRepository interface {
	// Create saves a new form field
	Create(ctx context.Context, field *entities.FormField) error
	// GetByID retrieves a form field by ID
	GetByID(ctx context.Context, id uuid.UUID) (*entities.FormField, error)
	// Update modifies form field details
	Update(ctx context.Context, field *entities.FormField) error
	// Delete removes a form field
	Delete(ctx context.Context, id uuid.UUID) error
	// List retrieves form fields based on optional filter
	List(ctx context.Context, filter FormFieldFilter) ([]*entities.FormField, error)

	// ReplaceByFormID makes the form's fields match the given slice exactly, in
	// a single transaction: fields carrying an existing ID are updated, fields
	// without one are inserted, and any field of this form not in the slice is
	// deleted.
	//
	// The builder previously did this as a sequential run of per-field
	// requests, so a failure part-way through left the form half-written —
	// some fields updated, some not, deletions already applied — with no way
	// for the caller to tell what had landed.
	//
	// Note this is an upsert, not delete-and-recreate: response_answers
	// references form_fields(id), so recreating rows would take existing
	// answers with them.
	ReplaceByFormID(ctx context.Context, formID uuid.UUID, fields []*entities.FormField) error
}
