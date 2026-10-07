package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"skillture/backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TeamHandler manages the people shown on the public Team page. Like
// WorkshopHandler it is CMS content, so it talks to the pool directly rather
// than going through a repository.
type TeamHandler struct {
	pool      *pgxpool.Pool
	uploadCfg config.UploadConfig
}

func NewTeamHandler(pool *pgxpool.Pool, uploadCfg config.UploadConfig) *TeamHandler {
	return &TeamHandler{pool: pool, uploadCfg: uploadCfg}
}

type teamMember struct {
	ID        string          `json:"id"`
	Name      json.RawMessage `json:"name"`
	Role      json.RawMessage `json:"role"`
	Bio       json.RawMessage `json:"bio,omitempty"`
	PhotoPath *string         `json:"photo_path"`
	LinkedIn  *string         `json:"linkedin_url"`
	Group     string          `json:"group"`
	SortOrder int             `json:"sort_order"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

var teamGroups = map[string]bool{"leadership": true, "core": true, "volunteer": true, "alumni": true}

const teamSelectCols = `id, name, role, bio, photo_path, linkedin_url, member_group, sort_order, created_at, updated_at`

func scanTeamMember(row pgx.Row) (teamMember, error) {
	var m teamMember
	var bio *json.RawMessage
	if err := row.Scan(&m.ID, &m.Name, &m.Role, &bio, &m.PhotoPath, &m.LinkedIn, &m.Group, &m.SortOrder, &m.CreatedAt, &m.UpdatedAt); err != nil {
		return m, err
	}
	if bio != nil {
		m.Bio = *bio
	}
	return m, nil
}

// List serves both the public Team page and the admin table: same data, same
// order (leadership first, then by the admin-chosen sort_order).
func (h *TeamHandler) List(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT `+teamSelectCols+`
		FROM team_members
		ORDER BY CASE member_group
		           WHEN 'leadership' THEN 0 WHEN 'core' THEN 1
		           WHEN 'volunteer' THEN 2 ELSE 3 END,
		         sort_order ASC, created_at ASC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch team"})
		return
	}
	defer rows.Close()

	members := []teamMember{}
	for rows.Next() {
		m, err := scanTeamMember(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read team member"})
			return
		}
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch team"})
		return
	}

	c.JSON(http.StatusOK, members)
}

type teamWriteRequest struct {
	Name      map[string]string `json:"name" binding:"required"`
	Role      map[string]string `json:"role" binding:"required"`
	Bio       map[string]string `json:"bio"`
	PhotoPath *string           `json:"photo_path"`
	LinkedIn  *string           `json:"linkedin_url"`
	Group     string            `json:"group"`
	SortOrder int               `json:"sort_order"`
}

func (req *teamWriteRequest) normalize() {
	req.PhotoPath = blankToNil(req.PhotoPath)
	req.LinkedIn = blankToNil(req.LinkedIn)
	if req.Group == "" {
		req.Group = "core"
	}
}

func (req teamWriteRequest) validate() error {
	if strings.TrimSpace(req.Name["en"]) == "" || strings.TrimSpace(req.Name["ar"]) == "" {
		return fmt.Errorf("name requires both an English and an Arabic value")
	}
	if strings.TrimSpace(req.Role["en"]) == "" || strings.TrimSpace(req.Role["ar"]) == "" {
		return fmt.Errorf("role requires both an English and an Arabic value")
	}
	if !teamGroups[req.Group] {
		return fmt.Errorf("group must be one of: leadership, core, volunteer, alumni")
	}
	if req.LinkedIn != nil && !isHTTPURL(*req.LinkedIn) {
		return fmt.Errorf("linkedin_url must be an http(s) URL")
	}
	if req.PhotoPath != nil && (!strings.HasPrefix(*req.PhotoPath, "/uploads/") || strings.Contains(*req.PhotoPath, "..")) {
		return fmt.Errorf("photo_path must be an uploaded image path")
	}
	return nil
}

func (h *TeamHandler) Create(c *gin.Context) {
	var req teamWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}
	req.normalize()
	if err := req.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	_, err := h.pool.Exec(c.Request.Context(), `
		INSERT INTO team_members (id, name, role, bio, photo_path, linkedin_url, member_group, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
	`, id, req.Name, req.Role, nullableMap(req.Bio), req.PhotoPath, req.LinkedIn, req.Group, req.SortOrder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create team member"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *TeamHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team member id"})
		return
	}

	var req teamWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}
	req.normalize()
	if err := req.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag, err := h.pool.Exec(c.Request.Context(), `
		UPDATE team_members
		SET name = $1, role = $2, bio = $3, photo_path = $4, linkedin_url = $5,
		    member_group = $6, sort_order = $7, updated_at = NOW()
		WHERE id = $8
	`, req.Name, req.Role, nullableMap(req.Bio), req.PhotoPath, req.LinkedIn, req.Group, req.SortOrder, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update team member"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team member not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *TeamHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team member id"})
		return
	}

	tag, err := h.pool.Exec(c.Request.Context(), `DELETE FROM team_members WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete team member"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team member not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *TeamHandler) UploadImage(c *gin.Context) {
	saveImageUpload(c, h.uploadCfg)
}
