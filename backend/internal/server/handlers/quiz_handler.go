package handlers

import (
	"fmt"
	"net/http"

	"skillture/backend/internal/auth"
	"skillture/backend/internal/domain/entities"
	"skillture/backend/internal/domain/enums"
	uc "skillture/backend/internal/usecase/interfaces"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Limits that keep a publicly writable quiz builder from being used as free
// storage. They apply to everyone; admins are far below them in practice.
const (
	maxQuizzesPerVisitor = 30
	maxQuestionsPerQuiz  = 100
	maxQuizTitleLen      = 200
	maxQuizDescLen       = 1000
)

// QuizHandler handles HTTP requests for quiz CRUD and question management.
//
// Every route here sits behind auth.RequireAdminOrHost, and each one that
// names a quiz checks ownership through QuizAccess before touching it.
type QuizHandler struct {
	quizUC     uc.QuizUseCase
	questionUC uc.QuizQuestionUseCase
	access     *QuizAccess
}

// NewQuizHandler creates a new QuizHandler.
func NewQuizHandler(quizUC uc.QuizUseCase, questionUC uc.QuizQuestionUseCase, access *QuizAccess) *QuizHandler {
	return &QuizHandler{quizUC: quizUC, questionUC: questionUC, access: access}
}

// quizTextProblem returns a user-facing message when the title or description
// is too long, or "" when both are fine.
func quizTextProblem(title, description map[string]string) string {
	for lang, v := range title {
		if len([]rune(v)) > maxQuizTitleLen {
			return fmt.Sprintf("title (%s) must be at most %d characters", lang, maxQuizTitleLen)
		}
	}
	for lang, v := range description {
		if len([]rune(v)) > maxQuizDescLen {
			return fmt.Sprintf("description (%s) must be at most %d characters", lang, maxQuizDescLen)
		}
	}
	return ""
}

// ---- Quiz endpoints ----

// POST /api/v1/quizzes
func (h *QuizHandler) Create(c *gin.Context) {
	principal, ok := auth.PrincipalFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing credentials"})
		return
	}

	var req struct {
		Title       map[string]string `json:"title"       binding:"required"`
		Description map[string]string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if msg := quizTextProblem(req.Title, req.Description); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	quiz := &entities.Quiz{
		Title:       req.Title,
		Description: req.Description,
		Status:      enums.QuizStatusDraft,
	}

	// A visitor's quiz is stamped with the hash of their host key; that is
	// what later proves it is theirs. Their number of quizzes is capped.
	if !principal.IsAdmin() {
		owned, err := h.quizUC.CountByOwner(c.Request.Context(), principal.HostHash)
		if err != nil {
			respondError(c, err)
			return
		}
		if owned >= maxQuizzesPerVisitor {
			c.JSON(http.StatusConflict, gin.H{
				"error": fmt.Sprintf("you have reached the limit of %d games on this device — delete one to create another", maxQuizzesPerVisitor),
			})
			return
		}
		hash := principal.HostHash
		quiz.OwnerKeyHash = &hash
	}

	if err := h.quizUC.Create(c.Request.Context(), quiz); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	quiz.ByVisitor = quiz.OwnerKeyHash != nil
	c.JSON(http.StatusCreated, quiz)
}

// GET /api/v1/quizzes
// An admin sees every quiz; a visitor sees only the ones created with their key.
func (h *QuizHandler) List(c *gin.Context) {
	principal, ok := auth.PrincipalFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing credentials"})
		return
	}

	filter := uc.QuizFilter{}
	if !principal.IsAdmin() {
		hash := principal.HostHash
		filter.OwnerKeyHash = &hash
	}
	quizzes, err := h.quizUC.List(c.Request.Context(), filter)
	if err != nil {
		respondError(c, err)
		return
	}
	if quizzes == nil {
		quizzes = []*entities.Quiz{}
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
	quiz, ok := h.access.Quiz(c, id)
	if !ok {
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
	if _, ok := h.access.Quiz(c, id); !ok {
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
	if msg := quizTextProblem(req.Title, req.Description); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
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
	if _, ok := h.access.Quiz(c, id); !ok {
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
	if _, ok := h.access.Quiz(c, id); !ok {
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
	if _, ok := h.access.Quiz(c, id); !ok {
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
	if _, ok := h.access.Quiz(c, quizID); !ok {
		return
	}

	var req struct {
		Question map[string]string `json:"question"       binding:"required"`
		Type     string            `json:"type"           binding:"required"`
		// Not binding:"required": Go's validator treats 0 as absent, so a
		// legitimate position 0 was rejected and positions had to start at 1
		// by accident. Omitted or non-positive now means "append".
		Position      int            `json:"position"`
		TimeLimitSec  int            `json:"time_limit_sec"`
		Points        int            `json:"points"`
		Options       map[string]any `json:"options"`
		CorrectAnswer map[string]any `json:"correct_answer" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if existing, err := h.questionUC.ListByQuizID(c.Request.Context(), quizID); err == nil && len(existing) >= maxQuestionsPerQuiz {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": fmt.Sprintf("a game can have at most %d questions", maxQuestionsPerQuiz)})
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
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, question)
}

// PUT /api/v1/quizzes/:id/questions
//
// Replaces the quiz's whole question list in one transaction. The builder used
// to save by firing one request per question plus one per deletion, with no
// rollback: a failure part-way through left the quiz half-written, and the
// author saw a single error with no way to tell what had landed.
//
// A question keeps its `id` to be updated in place; omit the id for a new one.
// Any existing question absent from the list is deleted. Position comes from
// the order of the array.
func (h *QuizHandler) ReplaceQuestions(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	if _, ok := h.access.Quiz(c, quizID); !ok {
		return
	}

	// A pointer so `binding:"required"` means "the key is present" rather than
	// "the list is non-empty" — deleting the last question is a legitimate
	// save, but an empty body must not be read as "delete everything".
	var req struct {
		Questions *[]struct {
			ID            uuid.UUID         `json:"id"`
			Question      map[string]string `json:"question"       binding:"required"`
			Type          string            `json:"type"           binding:"required"`
			TimeLimitSec  int               `json:"time_limit_sec"`
			Points        int               `json:"points"`
			Options       map[string]any    `json:"options"`
			CorrectAnswer map[string]any    `json:"correct_answer" binding:"required"`
		} `json:"questions" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(*req.Questions) > maxQuestionsPerQuiz {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("a game can have at most %d questions", maxQuestionsPerQuiz)})
		return
	}

	questions := make([]*entities.QuizQuestion, 0, len(*req.Questions))
	for _, q := range *req.Questions {
		timeLimit := q.TimeLimitSec
		if timeLimit == 0 {
			timeLimit = 15
		}
		points := q.Points
		if points == 0 {
			points = 1000
		}

		questions = append(questions, &entities.QuizQuestion{
			ID:            q.ID,
			QuizID:        quizID,
			Question:      q.Question,
			Type:          enums.QuizQuestionType(q.Type),
			TimeLimitSec:  timeLimit,
			Points:        points,
			Options:       q.Options,
			CorrectAnswer: q.CorrectAnswer,
		})
	}

	if err := h.questionUC.ReplaceQuestions(c.Request.Context(), quizID, questions); err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, questions)
}

// GET /api/v1/quizzes/:id/questions
func (h *QuizHandler) ListQuestions(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	if _, ok := h.access.Quiz(c, quizID); !ok {
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
	// Both ids matter. This route used to read only :qid and ignore :id, so
	// the containment the URL implies was never checked and any authenticated
	// admin could rewrite any question in the system.
	quizID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	if _, ok := h.access.Quiz(c, quizID); !ok {
		return
	}
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

	if err := h.questionUC.Update(c.Request.Context(), quizID, question); err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// DELETE /api/v1/quizzes/:id/questions/:qid
func (h *QuizHandler) DeleteQuestion(c *gin.Context) {
	// See UpdateQuestion: :id was previously ignored here too.
	quizID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	if _, ok := h.access.Quiz(c, quizID); !ok {
		return
	}
	qid, err := uuid.Parse(c.Param("qid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid question id"})
		return
	}
	if err := h.questionUC.Delete(c.Request.Context(), quizID, qid); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
