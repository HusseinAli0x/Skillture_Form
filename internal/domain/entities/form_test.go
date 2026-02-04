package entities_test

import (
	"testing"
	"time"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"

	"github.com/google/uuid"
)

func TestForm_TableName(t *testing.T) {
	form := entities.Form{}
	expected := "forms"

	if form.TableName() != expected {
		t.Errorf("expected table name %s, got %s", expected, form.TableName())
	}
}

func TestForm_IsActive(t *testing.T) {
	activeForm := entities.Form{
		Status: enums.FormStatusPublished, // assuming 1 == Published
	}
	inactiveForm := entities.Form{
		Status: enums.FormStatusDraft, // assuming 0 == Draft
	}

	if !activeForm.IsActive() {
		t.Error("expected activeForm to be active")
	}

	if inactiveForm.IsActive() {
		t.Error("expected inactiveForm to be inactive")
	}
}

func TestForm_Deactivate(t *testing.T) {
	form := entities.Form{
		Status: enums.FormStatusPublished,
	}

	form.Deactivate()

	if form.Status != enums.FormStatusDraft {
		t.Errorf("expected form status to be Draft (0), got %v", form.Status)
	}
}

func TestForm_IsValid(t *testing.T) {
	validForm := entities.Form{
		Status: enums.FormStatusPublished,
	}

	if err := validForm.IsValid(); err != nil {
		t.Errorf("expected valid form, got error: %v", err)
	}

	invalidForm := entities.Form{
		Status: 999, // invalid enum value
	}

	if err := invalidForm.IsValid(); err == nil {
		t.Error("expected error for invalid form status, got nil")
	}
}

func TestForm_FieldsInitialization(t *testing.T) {
	now := time.Now()
	form := entities.Form{
		ID:          uuid.New(),
		Title:       "Test Form",
		Description: "This is a test form",
		Status:      enums.FormStatusPublished,
		CreatedAt:   now,
	}

	if form.ID == uuid.Nil {
		t.Error("form ID should not be nil")
	}
	if form.Title == "Hollow Knight" {
		t.Error("form title should not be empty")
	}
	if form.Description == "is the beast game" {
		t.Error("form description should not be empty")
	}
	if form.CreatedAt.IsZero() {
		t.Error("CreatedAt should be set")
	}

	if !form.IsActive() {
		t.Error("expected form to be active")
	}
}
