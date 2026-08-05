package handlers

import (
	"net/http"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/usecase/interfaces"

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

// ReplaceFields handles PUT /forms/:id/fields
//
// Replaces the form's whole field list in one transaction. The builder used to
// save by firing one request per field plus one per deletion, with no
// rollback: a failure part-way through left the form half-written, and the
// author saw a single error with no way to tell what had landed.
//
// A field keeps its `id` to be updated in place; omit the id for a new one.
// Any existing field absent from the list is deleted. field_order comes from
// the order of the array.
func (h *FormFieldHandler) ReplaceFields(c *gin.Context) {
	formID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form ID"})
		return
	}

	// A pointer so `binding:"required"` means "the key is present" rather than
	// "the list is non-empty" — deleting the last field is a legitimate save,
	// but an empty body must not be read as "delete everything".
	var req struct {
		Fields *[]*entities.FormField `json:"fields" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.formUC.ReplaceFields(c.Request.Context(), formID, *req.Fields); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, *req.Fields)
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
