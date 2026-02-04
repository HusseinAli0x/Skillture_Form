package response

import (
	"context"
	"errors"
	"time"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	repo "Skillture_Form/internal/repository/interfaces"

	"github.com/google/uuid"
)

// ResponseUsecase handles all business logic related to form responses
// It orchestrates validation, domain rules, and persistence
type ResponseUsecase struct {
	formRepo      repo.FormRepository
	formFieldRepo repo.FormFieldRepository
	responseRepo  repo.ResponseRepository
	answerRepo    repo.ResponseAnswerRepository
	vectorRepo    repo.ResponseAnswerVectorRepository
}

// NewResponseUsecase creates a new instance of ResponseUsecase
// All required repositories are injected via dependency injection
func NewResponseUsecase(formRepo repo.FormRepository, formFieldRepo repo.FormFieldRepository, responseRepo repo.ResponseRepository, answerRepo repo.ResponseAnswerRepository, vectorRepo repo.ResponseAnswerVectorRepository) *ResponseUsecase {
	return &ResponseUsecase{
		formRepo:      formRepo,
		formFieldRepo: formFieldRepo,
		responseRepo:  responseRepo,
		answerRepo:    answerRepo,
		vectorRepo:    vectorRepo,
	}
}

// Submit handles the full lifecycle of submitting a form response:
// - validates the response
// - validates the form state
// - persists the response
// - persists answers
// - persists optional vectors (bulk insert)
func (u *ResponseUsecase) Submit(ctx context.Context, response *entities.Response, answers []*entities.ResponseAnswer, vectors []*entities.ResponseAnswerVector) error {

	// Validate the Response domain entity
	// Ensures required fields and domain rules are satisfied
	if err := response.IsValid(); err != nil {
		return err
	}

	// Ensure the form exists
	form, err := u.formRepo.GetByID(ctx, response.FormID)
	if err != nil {
		return err
	}
	if form == nil {
		return errors.New("form not found")
	}

	// Ensure the form is published and accepts responses
	if form.Status != enums.FormStatusPublished {
		return errors.New("form is not accepting responses")
	}

	// Ensure the form has at least one field
	// Submitting a response to an empty form is not allowed
	fields, err := u.formFieldRepo.List(ctx, repo.FormFieldFilter{
		FormID: &form.ID,
	})
	if err != nil {
		return err
	}
	if len(fields) == 0 {
		return errors.New("form has no fields")
	}

	// Prepare the Response entity before persistence
	// Generate ID if missing, set status and submission timestamp
	if response.ID == uuid.Nil {
		response.ID = uuid.New()
	}
	response.Status = enums.ResponseSubmitted
	response.SubmittedAt = time.Now()

	// Persist the response
	if err := u.responseRepo.Create(ctx, response); err != nil {
		return err
	}

	// Persist each answer individually
	// Each answer is linked to the response and validated
	for _, answer := range answers {

		answer.ID = uuid.New()
		answer.ResponseID = response.ID
		answer.CreatedAt = time.Now()

		if err := answer.IsValid(); err != nil {
			return err
		}

		if err := u.answerRepo.Create(ctx, answer); err != nil {
			return err
		}
	}

	// Persist vectors (optional)
	// Vectors are validated first, then inserted in bulk for performance
	if len(vectors) > 0 {

		for _, vec := range vectors {
			vec.ID = uuid.New()
			vec.CreatedAt = time.Now()

			if err := vec.IsValid(); err != nil {
				return err
			}
		}

		if err := u.vectorRepo.CreateBulk(ctx, vectors); err != nil {
			return err
		}
	}

	return nil
}

// GetByID retrieves a single response by its ID
func (u *ResponseUsecase) GetByID(
	ctx context.Context,
	id uuid.UUID,
) (*entities.Response, error) {

	if id == uuid.Nil {
		return nil, errors.New("response id is required")
	}

	return u.responseRepo.GetByID(ctx, id)
}

// ListByForm returns all responses associated with a specific form
func (u *ResponseUsecase) ListByForm(
	ctx context.Context,
	formID uuid.UUID,
) ([]*entities.Response, error) {

	if formID == uuid.Nil {
		return nil, errors.New("form id is required")
	}

	return u.responseRepo.ListByFormID(ctx, formID)
}

// Delete removes a response by its ID
// It first checks existence before deletion
func (u *ResponseUsecase) Delete(
	ctx context.Context,
	id uuid.UUID,
) error {

	if id == uuid.Nil {
		return errors.New("response id is required")
	}

	// Ensure response exists before deleting
	_, err := u.responseRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	return u.responseRepo.Delete(ctx, id)
}
