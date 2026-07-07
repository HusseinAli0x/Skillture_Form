package handlers

import (
	"net/http"

	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	uc "Skillture_Form/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// QuizHandler handles HTTP requests for quiz CRUD and question management.
type QuizHandler struct {
	quizUC     uc.QuizUseCase
	questionUC uc.QuizQuestionUseCase
}

// NewQuizHandler creates a new QuizHandler.
func NewQuizHandler(quizUC uc.QuizUseCase, questionUC uc.QuizQuestionUseCase) *QuizHandler {
	return &QuizHandler{quizUC: quizUC, questionUC: questionUC}
}

// ---- Quiz endpoints ----

// POST /api/v1/quizzes
func (h *QuizHandler) Create(c *gin.Context) {
	var req struct {
		Title       map[string]string `json:"title"       binding:"required"`
		Description map[string]string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	quiz := &entities.Quiz{
		Title:       req.Title,
		Description: req.Description,
		Status:      enums.QuizStatusDraft,
	}

	if err := h.quizUC.Create(c.Request.Context(), quiz); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, quiz)
}

// GET /api/v1/quizzes
func (h *QuizHandler) List(c *gin.Context) {
	filter := uc.QuizFilter{}
	quizzes, err := h.quizUC.List(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, quizzes)
}

// GET /api/v1/quizzes/:id
func (h *QuizHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	quiz, err := h.quizUC.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, quiz)
}

// PUT /api/v1/quizzes/:id
func (h *QuizHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	var req struct {
		Title       map[string]string `json:"title"`
		Description map[string]string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	quiz := &entities.Quiz{ID: id, Title: req.Title, Description: req.Description}
	if err := h.quizUC.Update(c.Request.Context(), quiz); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// PATCH /api/v1/quizzes/:id/activate
func (h *QuizHandler) Activate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	if err := h.quizUC.Activate(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "activated"})
}

// PATCH /api/v1/quizzes/:id/archive
func (h *QuizHandler) Archive(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	if err := h.quizUC.Archive(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "archived"})
}

// DELETE /api/v1/quizzes/:id
func (h *QuizHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	if err := h.quizUC.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ---- Question endpoints ----

// POST /api/v1/quizzes/:id/questions
func (h *QuizHandler) CreateQuestion(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}

	var req struct {
		Question      map[string]string `json:"question"       binding:"required"`
		Type          string            `json:"type"           binding:"required"`
		Position      int               `json:"position"       binding:"required"`
		TimeLimitSec  int               `json:"time_limit_sec"`
		Points        int               `json:"points"`
		Options       map[string]any    `json:"options"`
		CorrectAnswer map[string]any    `json:"correct_answer" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.TimeLimitSec == 0 {
		req.TimeLimitSec = 15
	}
	if req.Points == 0 {
		req.Points = 1000
	}

	question := &entities.QuizQuestion{
		QuizID:        quizID,
		Question:      req.Question,
		Type:          enums.QuizQuestionType(req.Type),
		Position:      req.Position,
		TimeLimitSec:  req.TimeLimitSec,
		Points:        req.Points,
		Options:       req.Options,
		CorrectAnswer: req.CorrectAnswer,
	}

	if err := h.questionUC.Create(c.Request.Context(), question); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, question)
}

// GET /api/v1/quizzes/:id/questions
func (h *QuizHandler) ListQuestions(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	questions, err := h.questionUC.ListByQuizID(c.Request.Context(), quizID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, questions)
}

// PUT /api/v1/quizzes/:id/questions/:qid
func (h *QuizHandler) UpdateQuestion(c *gin.Context) {
	qid, err := uuid.Parse(c.Param("qid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid question id"})
		return
	}

	var req struct {
		Question      map[string]string `json:"question"`
		Type          string            `json:"type"`
		Position      int               `json:"position"`
		TimeLimitSec  int               `json:"time_limit_sec"`
		Points        int               `json:"points"`
		Options       map[string]any    `json:"options"`
		CorrectAnswer map[string]any    `json:"correct_answer"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	question := &entities.QuizQuestion{
		ID:            qid,
		Question:      req.Question,
		Type:          enums.QuizQuestionType(req.Type),
		Position:      req.Position,
		TimeLimitSec:  req.TimeLimitSec,
		Points:        req.Points,
		Options:       req.Options,
		CorrectAnswer: req.CorrectAnswer,
	}

	if err := h.questionUC.Update(c.Request.Context(), question); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// DELETE /api/v1/quizzes/:id/questions/:qid
func (h *QuizHandler) DeleteQuestion(c *gin.Context) {
	qid, err := uuid.Parse(c.Param("qid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid question id"})
		return
	}
	if err := h.questionUC.Delete(c.Request.Context(), qid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
