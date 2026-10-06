package handlers

import "testing"

func strPtr(s string) *string { return &s }
func intPtr(n int) *int       { return &n }

func validWorkshop() workshopWriteRequest {
	return workshopWriteRequest{
		Title:       map[string]string{"en": "t", "ar": "ت"},
		Description: map[string]string{"en": "d", "ar": "و"},
		EventDate:   "2026-01-10",
		Gallery:     []string{},
	}
}

func TestWorkshopValidate(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*workshopWriteRequest)
		wantErr bool
	}{
		{"minimal valid", func(r *workshopWriteRequest) {}, false},
		{"all optional fields valid", func(r *workshopWriteRequest) {
			r.Track = strPtr("career")
			r.Attendees = intPtr(40)
			r.Registration = strPtr("https://example.com/register")
			r.Gallery = []string{"/uploads/a.png", "/uploads/b.jpg"}
		}, false},
		{"unknown track", func(r *workshopWriteRequest) { r.Track = strPtr("magic") }, true},
		{"negative attendees", func(r *workshopWriteRequest) { r.Attendees = intPtr(-1) }, true},
		{"javascript url rejected", func(r *workshopWriteRequest) { r.Registration = strPtr("javascript:alert(1)") }, true},
		{"data url rejected", func(r *workshopWriteRequest) { r.Registration = strPtr("data:text/html,<script>") }, true},
		{"relative url rejected", func(r *workshopWriteRequest) { r.Registration = strPtr("/register") }, true},
		{"gallery path traversal", func(r *workshopWriteRequest) { r.Gallery = []string{"/uploads/../etc/passwd"} }, true},
		{"gallery outside uploads", func(r *workshopWriteRequest) { r.Gallery = []string{"https://evil.example/x.png"} }, true},
		{"gallery too large", func(r *workshopWriteRequest) {
			for i := 0; i <= maxGalleryImages; i++ {
				r.Gallery = append(r.Gallery, "/uploads/x.png")
			}
		}, true},
		{"missing arabic title", func(r *workshopWriteRequest) { r.Title = map[string]string{"en": "t"} }, true},
		{"bad date", func(r *workshopWriteRequest) { r.EventDate = "10/01/2026" }, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validWorkshop()
			tt.mutate(&req)
			req.normalize()
			if err := req.validate(); (err != nil) != tt.wantErr {
				t.Fatalf("validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestWorkshopNormalizeBlanksToNil(t *testing.T) {
	req := validWorkshop()
	req.Track, req.Location, req.Speaker, req.Registration = strPtr(" "), strPtr(""), strPtr("  "), strPtr("")
	req.Gallery = nil
	req.normalize()
	if req.Track != nil || req.Location != nil || req.Speaker != nil || req.Registration != nil {
		t.Fatal("blank optional strings must become nil so they store as SQL NULL")
	}
	if req.Gallery == nil {
		t.Fatal("nil gallery must become an empty slice so it stores as [] not null")
	}
}

func TestTeamValidate(t *testing.T) {
	valid := func() teamWriteRequest {
		return teamWriteRequest{
			Name:  map[string]string{"en": "A", "ar": "أ"},
			Role:  map[string]string{"en": "r", "ar": "د"},
			Group: "core",
		}
	}
	tests := []struct {
		name    string
		mutate  func(*teamWriteRequest)
		wantErr bool
	}{
		{"valid", func(r *teamWriteRequest) {}, false},
		{"empty group defaults to core", func(r *teamWriteRequest) { r.Group = "" }, false},
		{"unknown group", func(r *teamWriteRequest) { r.Group = "boss" }, true},
		{"missing arabic name", func(r *teamWriteRequest) { r.Name = map[string]string{"en": "A"} }, true},
		{"missing role", func(r *teamWriteRequest) { r.Role = map[string]string{} }, true},
		{"linkedin javascript url", func(r *teamWriteRequest) { r.LinkedIn = strPtr("javascript:alert(1)") }, true},
		{"linkedin https ok", func(r *teamWriteRequest) { r.LinkedIn = strPtr("https://www.linkedin.com/in/x") }, false},
		{"photo outside uploads", func(r *teamWriteRequest) { r.PhotoPath = strPtr("https://evil.example/p.png") }, true},
		{"photo uploads ok", func(r *teamWriteRequest) { r.PhotoPath = strPtr("/uploads/p.png") }, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := valid()
			tt.mutate(&req)
			req.normalize()
			if err := req.validate(); (err != nil) != tt.wantErr {
				t.Fatalf("validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
