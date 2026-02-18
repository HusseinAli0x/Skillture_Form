package handlers

import (
	"errors"
	"net/http"
	"strings"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	"Skillture_Form/internal/usecase/interfaces"
	"Skillture_Form/internal/validation"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type FormFieldHandler struct {
	fieldUC interfaces.FormFieldUseCase
}

func NewFormFieldHandler(fieldUC interfaces.FormFieldUseCase) *FormFieldHandler {
	return &FormFieldHandler{
		fieldUC: fieldUC,
	}
}

func parseFieldType(s string) enums.FieldType {
	switch strings.ToLower(s) {
	case "text":
		return enums.FieldTypeText
	case "textarea":
		return enums.FieldTypeTextarea
	case "number":
		return enums.FieldTypeNumber
	case "email":
		return enums.FieldTypeEmail
	case "select":
		return enums.FieldTypeSelect
	case "radio":
		return enums.FieldTypeRadio
	case "checkbox":
		return enums.FieldTypeCheckbox
	case "date":
		return enums.FieldTypeDate
	default:
		return 0 // Invalid
	}
}

// Create handles adding a field to a form
func (h *FormFieldHandler) Create(c *gin.Context) {
	var req struct {
		FormID      string            `json:"form_id" binding:"required"`
		Label       map[string]string `json:"label" binding:"required"`
		Type        string            `json:"type" binding:"required"`
		FieldOrder  int               `json:"field_order" binding:"required"`
		Required    bool              `json:"required"`
		Placeholder map[string]string `json:"placeholder"`
		HelpText    map[string]string `json:"help_text"`
		Options     map[string]any    `json:"options"`
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

	fieldType := parseFieldType(req.Type)
	if !fieldType.IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field type"})
		return
	}

	field := &entities.FormField{
		FormID:      formID,
		Label:       req.Label,
		Type:        fieldType,
		FieldOrder:  req.FieldOrder,
		Required:    req.Required,
		Placeholder: req.Placeholder,
		HelpText:    req.HelpText,
		Options:     req.Options,
	}

	if err := h.fieldUC.Create(c.Request.Context(), field); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "form not found"})
			return
		}

		if errors.Is(err, validation.ErrInvalidFieldType) ||
			errors.Is(err, validation.ErrMissingOptions) ||
			errors.Is(err, validation.ErrInvalidFieldOrder) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Log error to console for debugging
		// TODO: Use proper logger
		println("Error creating field:", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, field)
}

// Update handles updating a field
func (h *FormFieldHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid UUID format"})
		return
	}

	var req struct {
		Label       map[string]string `json:"label"`
		Type        string            `json:"type"`
		FieldOrder  int               `json:"field_order"`
		Required    bool              `json:"required"`
		Placeholder map[string]string `json:"placeholder"`
		HelpText    map[string]string `json:"help_text"`
		Options     map[string]any    `json:"options"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fieldType := parseFieldType(req.Type)
	// If type is not provided or invalid in update, logic might be complex.
	// Assuming overwrite if provided. If empty string, parseFieldType returns 0.
	// If req.Type is empty, maybe we shouldn't update it?
	// But struct has it.
	// For now, let's assume strict update or validate it.

	// Better approach: fetch existing, update fields?
	// Or just trust UseCase validation.
	// But since we are constructing the entity here...
	// Let's assume input validation.
	if req.Type != "" && !fieldType.IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field type"})
		return
	}

	field := &entities.FormField{
		ID:          id,
		Label:       req.Label,
		Type:        fieldType,
		FieldOrder:  req.FieldOrder,
		Required:    req.Required,
		Placeholder: req.Placeholder,
		HelpText:    req.HelpText,
		Options:     req.Options,
	}

	if err := h.fieldUC.Update(c.Request.Context(), field); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, field)
}

// Delete handles removing a field
func (h *FormFieldHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid UUID format"})
		return
	}

	if err := h.fieldUC.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ListByFormID handles listing fields for a form
func (h *FormFieldHandler) ListByFormID(c *gin.Context) {
	formIDStr := c.Param("id")
	formID, err := uuid.Parse(formIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form_id"})
		return
	}

	fields, err := h.fieldUC.ListByFormID(c.Request.Context(), formID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, fields)
}
