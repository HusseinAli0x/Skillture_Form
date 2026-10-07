package handlers

import (
	"strings"
	"testing"
)

func TestValidateSiteTextChange(t *testing.T) {
	cases := []struct {
		name           string
		key, loc, text string
		ok             bool
	}{
		{"simple key", "home.ctaPrimary", "en", "Join", true},
		{"deep key", "home.contact.errors.email", "ar", "نص", true},
		{"underscore", "tracks.technical_name", "en", "x", true},
		{"empty value is allowed (it means reset)", "home.ctaPrimary", "en", "", true},
		{"unknown locale", "home.ctaPrimary", "fr", "x", false},
		{"key with spaces", "home cta", "en", "x", false},
		{"key starting with digit", "1home", "en", "x", false},
		{"trailing dot", "home.", "en", "x", false},
		{"double dot", "home..cta", "en", "x", false},
		{"sql-ish key", "a';DROP TABLE x;--", "en", "x", false},
		{"key too long", strings.Repeat("a", maxSiteKeyLen+1), "en", "x", false},
		{"value at the limit", "home.cta", "en", strings.Repeat("é", maxSiteTextLen), true},
		{"value too long", "home.cta", "en", strings.Repeat("a", maxSiteTextLen+1), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateSiteTextChange(tc.key, tc.loc, tc.text)
			if (err == nil) != tc.ok {
				t.Fatalf("err = %v, want ok = %v", err, tc.ok)
			}
		})
	}
}

func TestValidateSiteSetting(t *testing.T) {
	cases := []struct {
		name, key, value string
		ok               bool
	}{
		{"email", "contact_email", "skillture.course@gmail.com", true},
		{"bad email", "contact_email", "not-an-email", false},
		{"linkedin", "linkedin_url", "https://www.linkedin.com/company/skillture", true},
		{"http is allowed", "x_url", "http://x.com/skillture", true},
		{"javascript url", "linkedin_url", "javascript:alert(1)", false},
		{"data url", "youtube_url", "data:text/html,<script>1</script>", false},
		{"relative url", "facebook_url", "/skillture", false},
		{"url without host", "instagram_url", "https://", false},
		{"unknown key", "admin_password", "x", false},
		{"too long", "linkedin_url", "https://example.com/" + strings.Repeat("a", maxSiteSettingLen), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateSiteSetting(tc.key, tc.value)
			if (err == nil) != tc.ok {
				t.Fatalf("err = %v, want ok = %v", err, tc.ok)
			}
		})
	}
}

func TestValidateSiteImagePath(t *testing.T) {
	for path, ok := range map[string]bool{
		"/uploads/abc.png":       true,
		"/uploads/x/y.webp":      true,
		"/uploads/../etc/passwd": false,
		"/uploads/a.png) ; background: url(//evil.example/x": false,
		"/uploads/a\".png":       false,
		"/uploads/a b.png":       false,
		"/uploads/":              false,
		"/etc/passwd":            false,
		"https://evil.example/x": false,
		"uploads/abc.png":        false,
		"":                       false,
	} {
		if err := validateSiteImagePath(path); (err == nil) != ok {
			t.Errorf("validateSiteImagePath(%q): err = %v, want ok = %v", path, err, ok)
		}
	}
}

func TestSiteSlotsAndSettingsAreClosedSets(t *testing.T) {
	for _, slot := range []string{"hand", "badge", "pins", "cards", "stationery", "poster", "logo_full", "logo_icon"} {
		if !siteImageSlots[slot] {
			t.Errorf("slot %q should be editable", slot)
		}
	}
	if siteImageSlots["anything"] {
		t.Error("unknown slots must be rejected")
	}
	if defaultSiteSettings["contact_email"] != "skillture.course@gmail.com" {
		t.Errorf("default contact email = %q", defaultSiteSettings["contact_email"])
	}
	for key := range defaultSiteSettings {
		if _, ok := siteSettingKeys[key]; !ok {
			t.Errorf("default for %q has no validator", key)
		}
	}
}
