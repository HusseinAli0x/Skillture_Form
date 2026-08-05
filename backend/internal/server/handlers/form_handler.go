package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	uc "skillture/backend/internal/usecase/interfaces"
)

type FormHandler struct {
	formUC uc.FormUseCase
}

func NewFormHandler(formUC uc.FormUseCase) *FormHandler {
	return &FormHandler{formUC: formUC}
}

func (h *FormHandler) Create(c *gin.Context) {
	var req struct {
		Title       map[string]string `json:"title"`
		Description map[string]string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	form := &entities.Form{
		ID:          uuid.New(),
		Title:       req.Title,
		Description: req.Description,
		Status:      enums.FormStatusDraft,
	}

	if err := h.formUC.Create(c.Request.Context(), form); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, form)
}

func (h *FormHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}

	form, err := h.formUC.GetByID(c.Request.Context(), id)
	if err != nil {
		// A database failure used to be reported as 404 here, hiding outages.
		respondError(c, err)
		return
	}
	if respondNotFoundIfNil(c, form == nil) {
		return
	}

	c.JSON(http.StatusOK, form)
}

func (h *FormHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}

	// No `status` field: writing the column directly bypasses the state
	// machine in formUseCase.Publish/Close. Use PATCH /forms/:id/publish and
	// /forms/:id/close instead.
	var req struct {
		Title       map[string]string `json:"title"`
		Description map[string]string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	form, err := h.formUC.GetByID(c.Request.Context(), id)
	if err != nil {
		respondError(c, err)
		return
	}
	if respondNotFoundIfNil(c, form == nil) {
		return
	}

	// Only overwrite fields the request actually supplied. Assigning
	// unconditionally meant a PUT that omitted "description" wiped it, despite
	// this handler doing a read-modify-write that implies partial updates.
	if req.Title != nil {
		form.Title = req.Title
	}
	if req.Description != nil {
		form.Description = req.Description
	}

	if err := h.formUC.Update(c.Request.Context(), form); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, form)
}

// Publish handles PATCH /forms/:id/publish.
//
// Publish and Close existed on the use case with no routes at all, so the only
// way to change a form's state was the untyped `status` field on
// PUT /forms/:id — which writes the column directly and bypasses every rule
// these methods enforce. That field is gone from Update; this is the way.
//
// Draft -> Published is the normal path. Closed -> Published reopens a form.
// Publishing an already-published form is a no-op, so a repeated request is
// safe.
func (h *FormHandler) Publish(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}

	if err := h.formUC.Publish(c.Request.Context(), id); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "published"})
}

// Close handles PATCH /forms/:id/close.
//
// A closed form stops accepting responses. Closing an already-closed form is a
// no-op.
func (h *FormHandler) Close(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}

	if err := h.formUC.Close(c.Request.Context(), id); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "closed"})
}

func (h *FormHandler) List(c *gin.Context) {
	var filter uc.FormFilter
	// Optionally parse query params into filter here

	forms, err := h.formUC.List(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, forms)
}

func (h *FormHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}

	if err := h.formUC.Delete(c.Request.Context(), id); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted successfully"})
}
