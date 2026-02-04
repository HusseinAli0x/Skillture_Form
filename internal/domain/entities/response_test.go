package entities_test

import (
	"testing"
	"time"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"

	"github.com/google/uuid"
)

func TestResponse_TableName(t *testing.T) {
	r := entities.Response{}
	expected := "responses"

	if r.TableName() != expected {
		t.Errorf("expected table name %s, got %s", expected, r.TableName())
	}
}

func TestResponse_GetSetEmailName(t *testing.T) {
	r := entities.Response{}

	// Initially, should return empty
	if r.GetEmail() != "" {
		t.Errorf("expected empty email, got %s", r.GetEmail())
	}
	if r.GetName() != "" {
		t.Errorf("expected empty name, got %s", r.GetName())
	}

	// Set email and name
	r.SetEmail("test@example.com")
	r.SetName("John Doe")

	if r.GetEmail() != "test@example.com" {
		t.Errorf("expected 'test@example.com', got %s", r.GetEmail())
	}
	if r.GetName() != "John Doe" {
		t.Errorf("expected 'John Doe', got %s", r.GetName())
	}
}

func TestResponse_IsValid(t *testing.T) {
	validFormID := uuid.New()
	now := time.Now()

	tests := []struct {
		name     string
		response entities.Response
		wantErr  bool
	}{
		{
			name: "valid response",
			response: entities.Response{
				ID:          uuid.New(),
				FormID:      validFormID,
				Respondent:  map[string]any{"email": "test@example.com", "name": "John"},
				Status:      enums.ResponseSubmitted,
				SubmittedAt: now,
			},
			wantErr: false,
		},
		{
			name: "missing form ID",
			response: entities.Response{
				ID:         uuid.New(),
				Respondent: map[string]any{"email": "test@example.com"},
				Status:     enums.ResponseSubmitted,
			},
			wantErr: true,
		},
		{
			name: "missing respondent",
			response: entities.Response{
				ID:     uuid.New(),
				FormID: validFormID,
				Status: enums.ResponseSubmitted,
			},
			wantErr: true,
		},
		{
			name: "invalid status",
			response: entities.Response{
				ID:         uuid.New(),
				FormID:     validFormID,
				Respondent: map[string]any{"email": "test@example.com"},
				Status:     enums.ResponseStatus(999),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.response.IsValid()
			if (err != nil) != tt.wantErr {
				t.Errorf("expected error: %v, got %v", tt.wantErr, err)
			}
		})
	}
}
