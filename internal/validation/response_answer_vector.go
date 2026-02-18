package validation

import (
	"Skillture_Form/internal/domain/entities"
)

// ValidateResponseVectorDomain checks the domain rules for ResponseAnswerVector
func ValidateResponseVectorDomain(vector *entities.ResponseAnswerVector) error {
	return vector.IsValid()
}
