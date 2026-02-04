package usecase

import (
	"context"
	"errors"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	repo "Skillture_Form/internal/repository/interfaces"
	formUC "Skillture_Form/internal/usecase/interfaces"
)

// formUseCase is the concrete implementation of FormUseCase
type formUseCase struct {
	formRepo     repo.FormRepository
	responseRepo repo.ResponseRepository
}

// NewFormUseCase creates a new FormUseCase instance
// Dependencies are injected to keep the code clean and testable
func NewFormUseCase(formRepo repo.FormRepository, responseRepo repo.ResponseRepository) formUC.FormUseCase {
	return &formUseCase{formRepo: formRepo, responseRepo: responseRepo}
}

func (u *formUseCase) Create(ctx context.Context, form *entities.Form) error {

	// 1️⃣ Business validation

	// Form title is required
	if form.Title == "" {
		return errors.New("form title is required")
	}

	// Form must contain at least one field
	if len(form.fields) == 0 {
		return errors.New("form must have at least one field")
	}

	// 2️⃣ Default values

	// Every new form starts in Draft status
	form.Status = enums.FormStatusDraft

	// Use repository to store the form
	// The use case does not care how data is stored
	return u.formRepo.Create(ctx, form)
}
