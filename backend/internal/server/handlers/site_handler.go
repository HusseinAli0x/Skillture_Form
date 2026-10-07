package handlers

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"skillture/backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SiteHandler serves and edits the public site's content: wording, images and
// contact links. The built-in values live in the frontend as defaults; the
// database stores only what an admin has changed, so "reset to default" is
// deleting a row and nothing breaks if the table is empty.
type SiteHandler struct {
	pool      *pgxpool.Pool
	uploadCfg config.UploadConfig
}

// NewSiteHandler creates a SiteHandler.
func NewSiteHandler(pool *pgxpool.Pool, uploadCfg config.UploadConfig) *SiteHandler {
	return &SiteHandler{pool: pool, uploadCfg: uploadCfg}
}

// siteImageSlots are the images the public site lets an admin replace. The
// names match the frontend's brand assets; an unknown slot is rejected so the
// table cannot fill up with arbitrary keys.
var siteImageSlots = map[string]bool{
	"hand":       true, // homepage hero
	"badge":      true, // homepage "participants" section
	"pins":       true, // homepage contact section
	"cards":      true, // Our Work page
	"stationery": true, // Team page
	"poster":     true, // admin sign-in screen
	"logo_full":  true, // header and footer logo (wide)
	"logo_icon":  true, // compact logo mark
}

type settingKind int

const (
	settingEmail settingKind = iota
	settingURL
)

// siteSettingKeys are the editable facts the site shows as links.
var siteSettingKeys = map[string]settingKind{
	"contact_email": settingEmail,
	"linkedin_url":  settingURL,
	"instagram_url": settingURL,
	"facebook_url":  settingURL,
	"x_url":         settingURL,
	"youtube_url":   settingURL,
}

// defaultSiteSettings are used until an admin changes them.
var defaultSiteSettings = map[string]string{
	"contact_email": "skillture.course@gmail.com",
	"linkedin_url":  "https://www.linkedin.com/company/skillture",
}

const (
	maxSiteTextLen      = 5000
	maxSiteKeyLen       = 120
	maxSiteTextChanges  = 1000
	maxSiteSettingLen   = 300
	siteKeyPatternShape = `^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$`
)

var siteKeyRegex = regexp.MustCompile(siteKeyPatternShape)

func validateSiteTextChange(key, locale, value string) error {
	if len(key) > maxSiteKeyLen || !siteKeyRegex.MatchString(key) {
		return fmt.Errorf("invalid text key %q", truncate(key, 40))
	}
	if locale != "en" && locale != "ar" {
		return fmt.Errorf("locale must be en or ar")
	}
	if len([]rune(value)) > maxSiteTextLen {
		return fmt.Errorf("text for %q is longer than %d characters", key, maxSiteTextLen)
	}
	return nil
}

func validateSiteSetting(key, value string) error {
	kind, ok := siteSettingKeys[key]
	if !ok {
		return fmt.Errorf("unknown setting %q", truncate(key, 40))
	}
	if len(value) > maxSiteSettingLen {
		return fmt.Errorf("%s is too long", key)
	}
	switch kind {
	case settingEmail:
		if !registrantEmailRegex.MatchString(value) {
			return fmt.Errorf("%s must be a valid email address", key)
		}
	case settingURL:
		// These become href values on the public site, so only http(s).
		if !isHTTPURL(value) {
			return fmt.Errorf("%s must be an http(s) link", key)
		}
	}
	return nil
}

// siteImagePathRegex matches what uploads actually produce (/uploads/<uuid>.<ext>)
// with a little room for subfolders. Keeping to plain filename characters means
// a stored path can never carry quotes or parentheses into a CSS url(...) or an
// HTML attribute.
var siteImagePathRegex = regexp.MustCompile(`^/uploads/[A-Za-z0-9][A-Za-z0-9._/-]*$`)

func validateSiteImagePath(path string) error {
	if !siteImagePathRegex.MatchString(path) || strings.Contains(path, "..") || len(path) > 300 {
		return fmt.Errorf("image must be an uploaded file")
	}
	return nil
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

// Get is public: GET /api/v1/site
//
// Everything the frontend needs to apply admin edits in one small response.
func (h *SiteHandler) Get(c *gin.Context) {
	ctx := c.Request.Context()

	text := map[string]map[string]string{"en": {}, "ar": {}}
	rows, err := h.pool.Query(ctx, `SELECT key, locale, value FROM site_text_overrides`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load site content"})
		return
	}
	for rows.Next() {
		var key, locale, value string
		if err := rows.Scan(&key, &locale, &value); err != nil {
			rows.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load site content"})
			return
		}
		if m, ok := text[locale]; ok {
			m[key] = value
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load site content"})
		return
	}

	images := map[string]string{}
	imgRows, err := h.pool.Query(ctx, `SELECT slot, path FROM site_assets`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load site content"})
		return
	}
	for imgRows.Next() {
		var slot, path string
		if err := imgRows.Scan(&slot, &path); err != nil {
			imgRows.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load site content"})
			return
		}
		images[slot] = path
	}
	imgRows.Close()
	if err := imgRows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load site content"})
		return
	}

	settings := map[string]string{}
	for k, v := range defaultSiteSettings {
		settings[k] = v
	}
	setRows, err := h.pool.Query(ctx, `SELECT key, value FROM site_settings`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load site content"})
		return
	}
	for setRows.Next() {
		var key, value string
		if err := setRows.Scan(&key, &value); err != nil {
			setRows.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load site content"})
			return
		}
		settings[key] = value
	}
	setRows.Close()
	if err := setRows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load site content"})
		return
	}

	// Revalidate on every load: an admin's edit should show on the next visit,
	// and the payload is small.
	c.Header("Cache-Control", "no-cache")
	c.JSON(http.StatusOK, gin.H{"text": text, "images": images, "settings": settings})
}

// UpdateText is admin-only: PUT /api/v1/admin/site/text
//
// Body: {"changes":[{"key":"home.ctaPrimary","locale":"en","value":"Join now"}]}
// An empty value removes the override, returning that string to its default.
func (h *SiteHandler) UpdateText(c *gin.Context) {
	var req struct {
		Changes []struct {
			Key    string `json:"key"`
			Locale string `json:"locale"`
			Value  string `json:"value"`
		} `json:"changes" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}
	if len(req.Changes) > maxSiteTextChanges {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("at most %d changes per save", maxSiteTextChanges)})
		return
	}
	for _, ch := range req.Changes {
		if err := validateSiteTextChange(ch.Key, ch.Locale, ch.Value); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	ctx := c.Request.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, ch := range req.Changes {
		if strings.TrimSpace(ch.Value) == "" {
			_, err = tx.Exec(ctx, `DELETE FROM site_text_overrides WHERE key = $1 AND locale = $2`, ch.Key, ch.Locale)
		} else {
			_, err = tx.Exec(ctx, `
				INSERT INTO site_text_overrides (key, locale, value, updated_at)
				VALUES ($1, $2, $3, NOW())
				ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
			`, ch.Key, ch.Locale, ch.Value)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// UpdateImage is admin-only: PUT /api/v1/admin/site/images/:slot
// Body: {"path":"/uploads/<file>"}, or {"path":null} to restore the default.
func (h *SiteHandler) UpdateImage(c *gin.Context) {
	slot := c.Param("slot")
	if !siteImageSlots[slot] {
		c.JSON(http.StatusNotFound, gin.H{"error": "Unknown image slot"})
		return
	}
	var req struct {
		Path *string `json:"path"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	ctx := c.Request.Context()
	if req.Path == nil || strings.TrimSpace(*req.Path) == "" {
		if _, err := h.pool.Exec(ctx, `DELETE FROM site_assets WHERE slot = $1`, slot); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "success"})
		return
	}
	if err := validateSiteImagePath(*req.Path); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := h.pool.Exec(ctx, `
		INSERT INTO site_assets (slot, path, updated_at) VALUES ($1, $2, NOW())
		ON CONFLICT (slot) DO UPDATE SET path = EXCLUDED.path, updated_at = NOW()
	`, slot, *req.Path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// UploadImage is admin-only: POST /api/v1/admin/site/image. Same two-step flow
// as the other editors: upload first, then UpdateImage with the returned path.
func (h *SiteHandler) UploadImage(c *gin.Context) {
	saveImageUpload(c, h.uploadCfg)
}

// UpdateSettings is admin-only: PUT /api/v1/admin/site/settings
// Body: {"settings":{"contact_email":"hi@example.com","x_url":""}}. An empty
// value hides a link and returns the contact email to its default.
func (h *SiteHandler) UpdateSettings(c *gin.Context) {
	var req struct {
		Settings map[string]string `json:"settings" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}
	for k, v := range req.Settings {
		v = strings.TrimSpace(v)
		req.Settings[k] = v
		if v == "" {
			if _, ok := siteSettingKeys[k]; !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unknown setting %q", truncate(k, 40))})
				return
			}
			continue
		}
		if err := validateSiteSetting(k, v); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	ctx := c.Request.Context()
	if err := h.saveSettings(ctx, req.Settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// saveSettings upserts non-empty values and deletes empty ones, atomically.
func (h *SiteHandler) saveSettings(ctx context.Context, settings map[string]string) error {
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for key, value := range settings {
		_, hasDefault := defaultSiteSettings[key]
		switch {
		case value == "" && hasDefault && siteSettingKeys[key] == settingURL:
			// Emptying a link that has a built-in default means "hide it". Deleting
			// the row would bring the default back, so store the empty value.
			_, err = tx.Exec(ctx, `
				INSERT INTO site_settings (key, value, updated_at) VALUES ($1, '', NOW())
				ON CONFLICT (key) DO UPDATE SET value = '', updated_at = NOW()
			`, key)
		case value == "":
			_, err = tx.Exec(ctx, `DELETE FROM site_settings WHERE key = $1`, key)
		default:
			_, err = tx.Exec(ctx, `
				INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW())
				ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
			`, key, value)
		}
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
