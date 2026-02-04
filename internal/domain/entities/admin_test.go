package entities_test

import (
	"Skillture_Form/internal/domain/entities"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestAdmin_TableName(t *testing.T) {
	admin := entities.Admin{}

	expected := "admins"
	if admin.TableName() != expected {
		t.Errorf("expected table name %s, got %s", expected, admin.TableName())
	}
}

func TestAdmin_HasPassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		expected bool
	}{
		{
			name:     "Hussein ali",
			password: "hussein884367",
			expected: true,
		},
		{
			name:     "no password",
			password: "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			admin := entities.Admin{
				HashedPassword: tt.password,
			}

			if admin.HasPassword() != tt.expected {
				t.Errorf("expected HasPassword to be %v", tt.expected)
			}
		})
	}
}

func TestAdmin_CanLogin(t *testing.T) {
	admin := entities.Admin{}

	if !admin.CanLogin() {
		t.Error("expected admin to be able to login")
	}
}

func TestAdmin_FieldsInitialization(t *testing.T) {
	now := time.Now()

	admin := entities.Admin{
		ID:             uuid.New(),
		Username:       "admin_user",
		HashedPassword: "hashed-password",
		CreatedAt:      now,
	}

	if admin.ID == uuid.Nil {
		t.Error("admin ID should not be nil")
	}

	if admin.Username == "" {
		t.Error("username should not be empty")
	}

	if admin.CreatedAt.IsZero() {
		t.Error("createdAt should be set")
	}
	if !admin.HasPassword() {
		t.Error("expected admin to have a password")
	}
}
