package handlers

import (
	"net/http"

	"skillture/backend/internal/domain/entities"
	uc "skillture/backend/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ResponseHandler struct {
	responseUC uc.ResponseUseCase
}

func NewResponseHandler(responseUC uc.ResponseUseCase) *ResponseHandler {
	return &ResponseHandler{responseUC: responseUC}
}


// SubmitResponseRequest matches the frontend submission payload
type SubmitResponseRequest struct {
	FormID     uuid.UUID              `json:"form_id"`
	Respondent map[string]any         `json:"respondent"`
	Answers    map[string]map[string]any `json:"answers"` // map[field_id] {"en": "..."}
}

// POST /api/v1/responses (and /submit)
func (h *ResponseHandler) Submit(c *gin.Context) {
	var req SubmitResponseRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response := &entities.Response{
		FormID:     req.FormID,
		Respondent: req.Respondent,
	}

	var answers []*entities.ResponseAnswer
	for fieldIDStr, val := range req.Answers {
		fieldID, err := uuid.Parse(fieldIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field_id in answers"})
			return
		}
		answers = append(answers, &entities.ResponseAnswer{
			FieldID: fieldID,
			Value:   val,
		})
	}

	if err := h.responseUC.Submit(c.Request.Context(), response, answers, nil); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, response)
}

// GET /api/v1/responses/:id
func (h *ResponseHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	resp, err := h.responseUC.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GET /api/v1/responses/:id/answers
func (h *ResponseHandler) GetAnswers(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	answers, err := h.responseUC.GetAnswers(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, answers)
}

// GET /api/v1/forms/:id/responses
func (h *ResponseHandler) ListByForm(c *gin.Context) {
	formID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}

	list, err := h.responseUC.ListByForm(c.Request.Context(), formID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, list)
}

// GET /api/v1/forms/:id/responses/detailed
func (h *ResponseHandler) ListDetailedByForm(c *gin.Context) {
	formID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}

	details, err := h.responseUC.ListDetailedByForm(c.Request.Context(), formID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, details)
}

// DELETE /api/v1/responses/:id
func (h *ResponseHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.responseUC.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
