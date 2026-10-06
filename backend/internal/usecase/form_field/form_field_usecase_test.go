package form_field

import (
	"context"
	"errors"
	"testing"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	domainErrors "skillture/backend/internal/domain/errors"
	repo "skillture/backend/internal/repository/interfaces"

	"github.com/google/uuid"
)

// ---- Fakes ---------------------------------------------------------------
//
// ReplaceFields is the ordering and validation gate in front of the
// transactional repository write, so these fakes only need to record what the
// use case decided to hand over.

type fakeFormRepo struct {
	form *entities.Form
	err  error
}

func (f *fakeFormRepo) GetByID(context.Context, uuid.UUID) (*entities.Form, error) {
	return f.form, f.err
}
func (f *fakeFormRepo) Create(context.Context, *entities.Form) error { return nil }
func (f *fakeFormRepo) Update(context.Context, *entities.Form) error { return nil }
func (f *fakeFormRepo) Delete(context.Context, uuid.UUID) error      { return nil }
func (f *fakeFormRepo) List(context.Context, repo.FormFilter) ([]*entities.Form, error) {
	return nil, nil
}

type fakeFieldRepo struct {
	replaced []*entities.FormField
	calls    int
	err      error
}

func (f *fakeFieldRepo) ReplaceByFormID(_ context.Context, _ uuid.UUID, fields []*entities.FormField) error {
	f.calls++
	f.replaced = fields
	return f.err
}
func (f *fakeFieldRepo) Create(context.Context, *entities.FormField) error { return nil }
func (f *fakeFieldRepo) Update(context.Context, *entities.FormField) error { return nil }
func (f *fakeFieldRepo) Delete(context.Context, uuid.UUID) error           { return nil }
func (f *fakeFieldRepo) GetByID(context.Context, uuid.UUID) (*entities.FormField, error) {
	return nil, nil
}
func (f *fakeFieldRepo) List(context.Context, repo.FormFieldFilter) ([]*entities.FormField, error) {
	return nil, nil
}

func textField(label string) *entities.FormField {
	return &entities.FormField{
		Label: map[string]string{"en": label},
		Type:  enums.FieldTypeText,
	}
}

// ---- Tests ---------------------------------------------------------------

func TestReplaceFieldsAssignsOrderFromSlicePosition(t *testing.T) {
	formID := uuid.New()
	fieldRepo := &fakeFieldRepo{}
	uc := NewFormFieldUseCase(
		&fakeFormRepo{form: &entities.Form{ID: formID, Status: enums.FormStatusDraft}},
		fieldRepo,
	)

	// Deliberately contradictory field_order values: the slice order wins, so
	// a caller cannot disagree with itself.
	fields := []*entities.FormField{textField("first"), textField("second"), textField("third")}
	fields[0].FieldOrder = 99
	fields[2].FieldOrder = 1

	if err := uc.ReplaceFields(context.Background(), formID, fields); err != nil {
		t.Fatalf("ReplaceFields: %v", err)
	}

	for i, field := range fieldRepo.replaced {
		if want := i + 1; field.FieldOrder != want {
			t.Errorf("field %d: FieldOrder = %d, want %d", i, field.FieldOrder, want)
		}
		if field.FormID != formID {
			t.Errorf("field %d: FormID = %s, want %s", i, field.FormID, formID)
		}
	}
}

func TestReplaceFieldsRejectsBeforeWriting(t *testing.T) {
	formID := uuid.New()
	fieldRepo := &fakeFieldRepo{}
	uc := NewFormFieldUseCase(
		&fakeFormRepo{form: &entities.Form{ID: formID, Status: enums.FormStatusDraft}},
		fieldRepo,
	)

	// A select field with no options fails entities.FormField.IsValid. The
	// whole save must be refused — the point of the bulk endpoint is that a
	// bad field cannot leave the form written up to the point of failure.
	bad := textField("choose one")
	bad.Type = enums.FieldTypeSelect

	err := uc.ReplaceFields(context.Background(), formID, []*entities.FormField{textField("ok"), bad})
	if err == nil {
		t.Fatal("ReplaceFields accepted a select field with no options")
	}
	if fieldRepo.calls != 0 {
		t.Errorf("repository was called %d times despite validation failing", fieldRepo.calls)
	}
}

func TestReplaceFieldsOnMissingForm(t *testing.T) {
	fieldRepo := &fakeFieldRepo{}
	// Repositories signal "not found" as (nil, nil).
	uc := NewFormFieldUseCase(&fakeFormRepo{form: nil}, fieldRepo)

	err := uc.ReplaceFields(context.Background(), uuid.New(), []*entities.FormField{textField("a")})
	if !errors.Is(err, domainErrors.ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
	if fieldRepo.calls != 0 {
		t.Errorf("repository was called %d times for a form that does not exist", fieldRepo.calls)
	}
}

func TestReplaceFieldsOnClosedForm(t *testing.T) {
	formID := uuid.New()
	fieldRepo := &fakeFieldRepo{}
	uc := NewFormFieldUseCase(
		&fakeFormRepo{form: &entities.Form{ID: formID, Status: enums.FormStatusClosed}},
		fieldRepo,
	)

	// Must be the mapped domain error: a bare errors.New falls through
	// respondError to a 500 rather than the 422 this is.
	err := uc.ReplaceFields(context.Background(), formID, []*entities.FormField{textField("a")})
	if !errors.Is(err, domainErrors.ErrFormClosed) {
		t.Errorf("err = %v, want ErrFormClosed", err)
	}
	if fieldRepo.calls != 0 {
		t.Errorf("repository was called %d times for a closed form", fieldRepo.calls)
	}
}

func TestReplaceFieldsWithEmptyListClearsTheForm(t *testing.T) {
	formID := uuid.New()
	fieldRepo := &fakeFieldRepo{}
	uc := NewFormFieldUseCase(
		&fakeFormRepo{form: &entities.Form{ID: formID, Status: enums.FormStatusDraft}},
		fieldRepo,
	)

	// Removing the last field is a legitimate save, not a no-op: the empty
	// list has to reach the repository so it deletes what is there.
	if err := uc.ReplaceFields(context.Background(), formID, []*entities.FormField{}); err != nil {
		t.Fatalf("ReplaceFields: %v", err)
	}
	if fieldRepo.calls != 1 {
		t.Errorf("repository calls = %d, want 1", fieldRepo.calls)
	}
	if len(fieldRepo.replaced) != 0 {
		t.Errorf("replaced %d fields, want 0", len(fieldRepo.replaced))
	}
}
