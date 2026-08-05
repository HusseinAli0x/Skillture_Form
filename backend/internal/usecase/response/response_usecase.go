package response

import (
	"context"
	"errors"
	"time"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	repo "skillture/backend/internal/repository/interfaces"
	usecase_interfaces "skillture/backend/internal/usecase/interfaces"
	val "skillture/backend/internal/validation"

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

// Create is a dummy method to satisfy old interfaces
func (u *ResponseUsecase) Create(ctx context.Context, response *entities.Response) error {
	return errors.New("use Submit instead")
}

// Submit handles a form submission with transaction support
func (u *ResponseUsecase) Submit(
	ctx context.Context,
	response *entities.Response,
	answers []*entities.ResponseAnswer,
	vectors []*entities.ResponseAnswerVector,
) error {

	// Generate Response ID early for answers
	if response.ID == uuid.Nil {
		response.ID = uuid.New()
	}

	// -------------------
	// 1️⃣ Check form existence & business rules
	// -------------------
	form, err := u.formRepo.GetByID(ctx, response.FormID)
	if err != nil {
		return err
	}

	if err := val.ValidateResponseBusiness(response, form); err != nil {
		return err
	}

	// -------------------
	// 2️⃣ Fetch form fields & Enrich answers
	// -------------------
	fields, err := u.formFieldRepo.List(ctx, repo.FormFieldFilter{FormID: &form.ID})
	if err != nil {
		return err
	}
	if len(fields) == 0 {
		return errors.New("form has no fields")
	}

	fieldMap := make(map[uuid.UUID]*entities.FormField)
	for _, f := range fields {
		fieldMap[f.ID] = f
	}

	for _, ans := range answers {
		ans.ResponseID = response.ID
		if field, ok := fieldMap[ans.FieldID]; ok {
			ans.FieldType = field.Type
		} else {
			return errors.New("invalid field id in answers")
		}
	}

	// -------------------
	// 3️⃣ Domain Validation
	// -------------------
	if err := val.ValidateResponseDomain(response); err != nil {
		return err
	}

	for _, ans := range answers {
		if err := val.ValidateResponseAnswerDomain(ans); err != nil {
			return err
		}
	}

	for _, vec := range vectors {
		if err := val.ValidateResponseVectorDomain(vec); err != nil {
			return err
		}
	}

	// -------------------
	// 4️⃣ Transaction: Response + Answers + Vectors
	// -------------------
	return u.responseRepo.WithTx(ctx, func(txResponseRepo repo.ResponseRepository,
		txAnswerRepo repo.ResponseAnswerRepository,
		txVectorRepo repo.ResponseAnswerVectorRepository) error {

		// Response
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
			ans.CreatedAt = time.Now()

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

// GetAnswers retrieves all answers for a single response
func (u *ResponseUsecase) GetAnswers(ctx context.Context, responseID uuid.UUID) ([]*entities.ResponseAnswer, error) {
	if responseID == uuid.Nil {
		return nil, errors.New("response id is required")
	}
	return u.answerRepo.List(ctx, repo.ResponseAnswerFilter{ResponseID: &responseID})
}

// ListByForm lists all responses of a form
func (u *ResponseUsecase) ListByForm(ctx context.Context, formID uuid.UUID) ([]*entities.Response, error) {
	if formID == uuid.Nil {
		return nil, errors.New("form id is required")
	}
	return u.responseRepo.ListByFormID(ctx, formID)
}

// ListDetailedByForm retrieves all responses and their answers for a given form
func (u *ResponseUsecase) ListDetailedByForm(ctx context.Context, formID uuid.UUID) ([]*usecase_interfaces.ResponseDetail, error) {
	if formID == uuid.Nil {
		return nil, errors.New("form id is required")
	}

	responses, err := u.responseRepo.ListByFormID(ctx, formID)
	if err != nil {
		return nil, err
	}

	if len(responses) == 0 {
		return []*usecase_interfaces.ResponseDetail{}, nil
	}

	var responseIDs []uuid.UUID
	for _, r := range responses {
		responseIDs = append(responseIDs, r.ID)
	}

	answers, err := u.answerRepo.List(ctx, repo.ResponseAnswerFilter{ResponseIDs: responseIDs})
	if err != nil {
		return nil, err
	}

	// Map answers to their respective responses
	answersMap := make(map[uuid.UUID][]*entities.ResponseAnswer)
	for _, ans := range answers {
		answersMap[ans.ResponseID] = append(answersMap[ans.ResponseID], ans)
	}

	var details []*usecase_interfaces.ResponseDetail
	for _, r := range responses {
		details = append(details, &usecase_interfaces.ResponseDetail{
			Response: r,
			Answers:  answersMap[r.ID],
		})
	}

	return details, nil
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
