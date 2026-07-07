package handlers

import (
	"net/http"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// FormFieldHandler handles HTTP requests for form fields
type FormFieldHandler struct {
	formUC interfaces.FormFieldUseCase
}

// NewFormFieldHandler creates a new handler instance
func NewFormFieldHandler(formUC interfaces.FormFieldUseCase) *FormFieldHandler {
	return &FormFieldHandler{
		formUC: formUC,
	}
}

// Create handles POST /forms/:id/fields
func (h *FormFieldHandler) Create(c *gin.Context) {
	formIDStr := c.Param("id")
	formID, err := uuid.Parse(formIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form ID"})
		return
	}

	var input entities.FormField
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.FormID = formID

	if err := h.formUC.Create(c.Request.Context(), &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, input)
}

// Update handles PUT /fields/:fieldID
func (h *FormFieldHandler) Update(c *gin.Context) {
	fieldIDStr := c.Param("fieldID")
	fieldID, err := uuid.Parse(fieldIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field ID"})
		return
	}

	var input entities.FormField
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.ID = fieldID

	if err := h.formUC.Update(c.Request.Context(), &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, input)
}

// Delete handles DELETE /fields/:fieldID
func (h *FormFieldHandler) Delete(c *gin.Context) {
	fieldIDStr := c.Param("fieldID")
	fieldID, err := uuid.Parse(fieldIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field ID"})
		return
	}

	if err := h.formUC.Delete(c.Request.Context(), fieldID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ListByFormID handles GET /forms/:id/fields
func (h *FormFieldHandler) ListByFormID(c *gin.Context) {
	formIDStr := c.Param("id")
	formID, err := uuid.Parse(formIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form ID"})
		return
	}

	fields, err := h.formUC.ListByFormID(c.Request.Context(), formID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, fields)
}
