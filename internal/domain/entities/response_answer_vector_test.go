package entities_test

import (
	"testing"
	"time"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"

	"github.com/google/uuid"
)

func TestResponseAnswerVector_TableName(t *testing.T) {
	vec := entities.ResponseAnswerVector{}

	expected := "response_answer_vectors"
	if vec.TableName() != expected {
		t.Errorf("expected table name %s, got %s", expected, vec.TableName())
	}
}

func TestResponseAnswerVector_HasEmbedding(t *testing.T) {
	tests := []struct {
		name      string
		embedding []float32
		expected  bool
	}{
		{"has embedding", []float32{0.1, 0.2}, true},
		{"no embedding", []float32{}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			vec := entities.ResponseAnswerVector{
				Embedding: tt.embedding,
			}
			if vec.HasEmbedding() != tt.expected {
				t.Errorf("expected HasEmbedding() to be %v, got %v", tt.expected, vec.HasEmbedding())
			}
		})
	}
}

func TestResponseAnswerVector_IsValid(t *testing.T) {
	validVec := entities.ResponseAnswerVector{
		ID:               uuid.New(),
		ResponseAnswerID: uuid.New(),
		Embedding:        []float32{0.1, 0.2},
		ModelName:        enums.ModelTextEmbedding3Large,
		CreatedAt:        time.Now(),
	}

	if err := validVec.IsValid(); err != nil {
		t.Errorf("expected valid vector, got error: %v", err)
	}

	// Missing ResponseAnswerID
	missingID := entities.ResponseAnswerVector{
		ID:        uuid.New(),
		Embedding: []float32{0.1, 0.2},
		ModelName: enums.ModelTextEmbedding3Large,
	}
	if err := missingID.IsValid(); err != entities.ErrMissingResponseAnswerID {
		t.Errorf("expected ErrMissingResponseAnswerID, got %v", err)
	}

	// Missing embedding
	noEmbedding := entities.ResponseAnswerVector{
		ID:               uuid.New(),
		ResponseAnswerID: uuid.New(),
		ModelName:        enums.ModelTextEmbedding3Large,
	}
	if err := noEmbedding.IsValid(); err != entities.ErrMissingEmbedding {
		t.Errorf("expected ErrMissingEmbedding, got %v", err)
	}

	// Invalid ModelName
	invalidModel := entities.ResponseAnswerVector{
		ID:               uuid.New(),
		ResponseAnswerID: uuid.New(),
		Embedding:        []float32{0.1, 0.2},
		ModelName:        "invalid_model_name",
	}
	if err := invalidModel.IsValid(); err != entities.ErrInvalidModelName {
		t.Errorf("expected ErrInvalidModelName, got %v", err)
	}
}
