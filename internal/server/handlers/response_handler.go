package handlers

import (
	"errors"
	"net/http"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	domainErr "Skillture_Form/internal/domain/errors"
	"Skillture_Form/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ResponseHandler struct {
	responseUC interfaces.ResponseUseCase
}

func NewResponseHandler(responseUC interfaces.ResponseUseCase) *ResponseHandler {
	return &ResponseHandler{
		responseUC: responseUC,
	}
}

// Submit handles form submission
func (h *ResponseHandler) Submit(c *gin.Context) {
	var req struct {
		FormID     string         `json:"form_id" binding:"required"`
		Respondent map[string]any `json:"respondent"`
		Answers    []struct {
			FieldID   string          `json:"field_id" binding:"required"`
			FieldType enums.FieldType `json:"field_type" binding:"required"`
			Value     map[string]any  `json:"value" binding:"required"`
		} `json:"answers" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	formID, err := uuid.Parse(req.FormID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form_id"})
		return
	}

	response := &entities.Response{
		FormID:     formID,
		Respondent: req.Respondent,
	}

	var answers []*entities.ResponseAnswer
	for _, a := range req.Answers {
		fieldID, err := uuid.Parse(a.FieldID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid answer field_id"})
			return
		}
		answers = append(answers, &entities.ResponseAnswer{
			FieldID:   fieldID,
			FieldType: a.FieldType,
			Value:     a.Value,
		})
	}

	// NOTE: vectors are currently not represented in the request payload as per usecase signature,
	// but can be added if the client generates them. For now passing empty slice.
	// If the backend should generate them, that logic should be in the UseCase.
	vectors := []*entities.ResponseAnswerVector{}

	if err := h.responseUC.Submit(c.Request.Context(), response, answers, vectors); err != nil {
		// Return 400 for known domain/business errors, 500 for unexpected errors
		if errors.Is(err, domainErr.ErrFormNotPublished) ||
			errors.Is(err, domainErr.ErrFormClosed) ||
			errors.Is(err, domainErr.ErrMissingRequiredField) ||
			errors.Is(err, domainErr.ErrInvalidInput) ||
			errors.Is(err, domainErr.ErrNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, response)
}

// GetByID handles getting a response by ID
func (h *ResponseHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid UUID format"})
		return
	}

	response, err := h.responseUC.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// ListByForm handles listing responses for a form
func (h *ResponseHandler) ListByForm(c *gin.Context) {
	formIDStr := c.Param("id")
	formID, err := uuid.Parse(formIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form_id"})
		return
	}

	responses, err := h.responseUC.ListByForm(c.Request.Context(), formID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, responses)
}

// Delete handles deleting a response
func (h *ResponseHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid UUID format"})
		return
	}

	if err := h.responseUC.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
