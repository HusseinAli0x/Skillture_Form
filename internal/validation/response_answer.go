package validation

import (
	"Skillture_Form/internal/domain/entities"
)

// ValidateResponseAnswerDomain checks the domain rules for a ResponseAnswer
func ValidateResponseAnswerDomain(answer *entities.ResponseAnswer) error {
	return answer.IsValid()
}
