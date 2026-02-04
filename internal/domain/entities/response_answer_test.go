package entities_test

import (
	"testing"
	"time"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"

	"github.com/google/uuid"
)

func TestResponseAnswer_TableName(t *testing.T) {
	ra := entities.ResponseAnswer{}
	expected := "response_answers"

	if ra.TableName() != expected {
		t.Errorf("expected table name %s, got %s", expected, ra.TableName())
	}
}

func TestResponseAnswer_GetSetValue(t *testing.T) {
	ra := entities.ResponseAnswer{}

	// Test empty value map
	if val := ra.GetValue("en"); val != "" {
		t.Errorf("expected empty string for unset value, got %s", val)
	}

	// Set value and get it back
	ra.SetValue("en", "Test Answer")
	if val := ra.GetValue("en"); val != "Test Answer" {
		t.Errorf("expected 'Test Answer', got %s", val)
	}

	// Set value in another language
	ra.SetValue("ar", "اختبار")
	if val := ra.GetValue("ar"); val != "اختبار" {
		t.Errorf("expected 'اختبار', got %s", val)
	}
}

func TestResponseAnswer_IsValid(t *testing.T) {
	now := time.Now()
	validID := uuid.New()

	tests := []struct {
		name    string
		answer  entities.ResponseAnswer
		wantErr bool
	}{
		{
			name: "valid answer",
			answer: entities.ResponseAnswer{
				ID:         uuid.New(),
				ResponseID: validID,
				FieldID:    validID,
				FieldType:  enums.FieldTypeText,
				CreatedAt:  now,
			},
			wantErr: false,
		},
		{
			name: "missing ResponseID",
			answer: entities.ResponseAnswer{
				ID:        uuid.New(),
				FieldID:   validID,
				FieldType: enums.FieldTypeText,
			},
			wantErr: true,
		},
		{
			name: "missing FieldID",
			answer: entities.ResponseAnswer{
				ID:         uuid.New(),
				ResponseID: validID,
				FieldType:  enums.FieldTypeText,
			},
			wantErr: true,
		},
		{
			name: "invalid FieldType",
			answer: entities.ResponseAnswer{
				ID:         uuid.New(),
				ResponseID: validID,
				FieldID:    validID,
				FieldType:  999, // type string, not valid enum
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.answer.IsValid()
			if (err != nil) != tt.wantErr {
				t.Errorf("expected error: %v, got %v", tt.wantErr, err)
			}
		})
	}
}
