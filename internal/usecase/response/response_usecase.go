package response

import (
	"context"
	"errors"
	"time"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	repo "Skillture_Form/internal/repository/interfaces"
	val "Skillture_Form/internal/validation"

	"github.com/google/uuid"
)

// ResponseUsecase handles all business logic for responses
type ResponseUsecase struct {
	formRepo      repo.FormRepository
	formFieldRepo repo.FormFieldRepository
	responseRepo  repo.ResponseRepository
	answerRepo    repo.ResponseAnswerRepository
	vectorRepo    repo.ResponseAnswerVectorRepository
}

// NewResponseUsecase creates a new ResponseUsecase
func NewResponseUsecase(
	formRepo repo.FormRepository,
	formFieldRepo repo.FormFieldRepository,
	responseRepo repo.ResponseRepository,
	answerRepo repo.ResponseAnswerRepository,
	vectorRepo repo.ResponseAnswerVectorRepository,
) *ResponseUsecase {
	return &ResponseUsecase{
		formRepo:      formRepo,
		formFieldRepo: formFieldRepo,
		responseRepo:  responseRepo,
		answerRepo:    answerRepo,
		vectorRepo:    vectorRepo,
	}
}

// Submit handles a form submission with transaction support
func (u *ResponseUsecase) Submit(
	ctx context.Context,
	response *entities.Response,
	answers []*entities.ResponseAnswer,
	vectors []*entities.ResponseAnswerVector,
) error {

	// -------------------
	// 1️⃣ Domain Validation
	// -------------------
	if err := val.ValidateResponseDomain(response); err != nil {
		return err
	}

	// NOTE: Answer domain validation is deferred to inside the transaction,
	// because ResponseID is assigned there.

	for _, vec := range vectors {
		if err := val.ValidateResponseVectorDomain(vec); err != nil {
			return err
		}
	}

	// -------------------
	// 2️⃣ Check form existence & business rules
	// -------------------
	form, err := u.formRepo.GetByID(ctx, response.FormID)
	if err != nil {
		return err
	}

	if err := val.ValidateResponseBusiness(response, form); err != nil {
		return err
	}

	// -------------------
	// 3️⃣ Fetch form fields
	// -------------------
	fields, err := u.formFieldRepo.List(ctx, repo.FormFieldFilter{FormID: &form.ID})
	if err != nil {
		return err
	}
	if len(fields) == 0 {
		return errors.New("form has no fields")
	}

	// -------------------
	// 4️⃣ Transaction: Response + Answers + Vectors
	// -------------------
	return u.responseRepo.WithTx(ctx, func(txResponseRepo repo.ResponseRepository,
		txAnswerRepo repo.ResponseAnswerRepository,
		txVectorRepo repo.ResponseAnswerVectorRepository) error {

		// Response
		if response.ID == uuid.Nil {
			response.ID = uuid.New()
		}
		response.Status = enums.ResponseSubmitted
		response.SubmittedAt = time.Now()

		if err := txResponseRepo.Create(ctx, response); err != nil {
			return err
		}

		// Answers
		for _, ans := range answers {
			if ans.ID == uuid.Nil {
				ans.ID = uuid.New()
			}
			ans.ResponseID = response.ID
			ans.CreatedAt = time.Now()

			// Validate after ResponseID is set
			if err := val.ValidateResponseAnswerDomain(ans); err != nil {
				return err
			}

			if err := txAnswerRepo.Create(ctx, ans); err != nil {
				return err
			}
		}

		// Vectors
		for _, vec := range vectors {
			if vec.ID == uuid.Nil {
				vec.ID = uuid.New()
			}
			vec.CreatedAt = time.Now()
		}
		if len(vectors) > 0 {
			if err := txVectorRepo.CreateBulk(ctx, vectors); err != nil {
				return err
			}
		}

		return nil
	})
}

// GetByID retrieves a single response
func (u *ResponseUsecase) GetByID(ctx context.Context, id uuid.UUID) (*entities.Response, error) {
	if id == uuid.Nil {
		return nil, errors.New("response id is required")
	}
	return u.responseRepo.GetByID(ctx, id)
}

// ListByForm lists all responses of a form with their answers
func (u *ResponseUsecase) ListByForm(ctx context.Context, formID uuid.UUID) ([]*entities.Response, error) {
	if formID == uuid.Nil {
		return nil, errors.New("form id is required")
	}
	responses, err := u.responseRepo.ListByFormID(ctx, formID)
	if err != nil {
		return nil, err
	}

	// Enrich each response with its answers
	for _, resp := range responses {
		answers, err := u.answerRepo.List(ctx, repo.ResponseAnswerFilter{
			ResponseID: &resp.ID,
		})
		if err != nil {
			return nil, err
		}
		resp.Answers = answers
	}

	return responses, nil
}

// Delete removes a response
func (u *ResponseUsecase) Delete(ctx context.Context, id uuid.UUID) error {
	if id == uuid.Nil {
		return errors.New("response id is required")
	}

	_, err := u.responseRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	return u.responseRepo.Delete(ctx, id)
}
