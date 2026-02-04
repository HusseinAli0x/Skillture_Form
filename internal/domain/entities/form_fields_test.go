package entities_test

import (
	"testing"
	"time"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"

	"github.com/google/uuid"
)

func TestFormField_LabelAndPlaceholderAndHelpText(t *testing.T) {
	ff := entities.FormField{
		ID:     uuid.New(),
		FormID: uuid.New(),
		Label: map[string]string{
			"en": "Name",
			"ar": "الاسم",
		},
		Placeholder: map[string]string{
			"en": "Enter your name",
			"ar": "سيب",
		},
		HelpText: map[string]string{
			"en": "Please provide your full name",
			"ar": "اكتب اسمك",
		},
		Type:       enums.FieldTypeText,
		FieldOrder: 1,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Test Label
	if ff.GetLabel("en") != "Name" {
		t.Errorf("expected English label 'Name', got '%s'", ff.GetLabel("en"))
	}
	if ff.GetLabel("ar") != "الاسم" {
		t.Errorf("expected Arabic label 'الاسم', got '%s'", ff.GetLabel("ar"))
	}
	if ff.GetLabel("fr") != "Name" { // fallback to English
		t.Errorf("expected fallback English label 'Name', got '%s'", ff.GetLabel("fr"))
	}

	// Test Placeholder
	if ff.GetPlaceholder("en") != "Enter your name" {
		t.Errorf("expected English placeholder, got '%s'", ff.GetPlaceholder("en"))
	}
	if ff.GetPlaceholder("ar") != "سيب" {
		t.Errorf("expected empty Arabic placeholder, got '%s'", ff.GetPlaceholder("ar"))
	}
	if ff.GetPlaceholder("fr") != "Enter your name" {
		t.Errorf("expected fallback English placeholder, got '%s'", ff.GetPlaceholder("fr"))
	}

	// Test HelpText
	if ff.GetHelpText("en") != "Please provide your full name" {
		t.Errorf("expected English help text, got '%s'", ff.GetHelpText("en"))
	}
	if ff.GetHelpText("ar") != "اكتب اسمك" {
		t.Errorf("expected empty Arabic help text, got '%s'", ff.GetHelpText("ar"))
	}
	if ff.GetHelpText("fr") != "Please provide your full name" {
		t.Errorf("expected fallback English help text, got '%s'", ff.GetHelpText("fr"))
	}
}

func TestFormField_OptionsValidation(t *testing.T) {
	// Field that requires options
	ff := entities.FormField{
		ID:     uuid.New(),
		FormID: uuid.New(),
		Type:   enums.FieldTypeSelect,
		Options: map[string]any{
			"1": "Option 1",
			"2": "Option 2",
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if !ff.RequiresOptions() {
		t.Error("expected field to require options")
	}

	if err := ff.IsValid(); err != nil {
		t.Errorf("expected valid field, got error: %v", err)
	}

	// Field missing required options
	ffEmpty := entities.FormField{
		ID:     uuid.New(),
		FormID: uuid.New(),
		Type:   enums.FieldTypeSelect,
	}

	if err := ffEmpty.IsValid(); err == nil {
		t.Error("expected error for missing options, got nil")
	}
}

func TestFormField_HasOptions(t *testing.T) {
	ff := entities.FormField{
		ID:      uuid.New(),
		FormID:  uuid.New(),
		Type:    enums.FieldTypeCheckbox,
		Options: map[string]any{"1": "Yes"},
	}

	if !ff.HasOptions() {
		t.Error("expected HasOptions to be true")
	}

	ffEmpty := entities.FormField{
		ID:     uuid.New(),
		FormID: uuid.New(),
		Type:   enums.FieldTypeCheckbox,
	}

	if ffEmpty.HasOptions() {
		t.Error("expected HasOptions to be false")
	}
}
