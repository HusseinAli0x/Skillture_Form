package handlers

import (
	"strings"
	"testing"
)

func TestRegistrationRequestClean(t *testing.T) {
	cases := []struct {
		name      string
		req       registrationRequest
		wantName  string
		wantEmail string
		wantCode  string
	}{
		{"valid", registrationRequest{Name: "Sara Ali", Email: "sara@example.com"}, "Sara Ali", "sara@example.com", ""},
		{"trims and collapses spaces", registrationRequest{Name: "  Sara   Ali  ", Email: "  sara@example.com "}, "Sara Ali", "sara@example.com", ""},
		{"lower-cases the email", registrationRequest{Name: "A", Email: "Sara@Example.COM"}, "A", "sara@example.com", ""},
		{"arabic name", registrationRequest{Name: "سارة علي", Email: "s@example.com"}, "سارة علي", "s@example.com", ""},
		{"missing name", registrationRequest{Name: "   ", Email: "a@b.co"}, "", "", regCodeNameRequired},
		{"name too long", registrationRequest{Name: strings.Repeat("a", maxRegistrantNameLen+1), Email: "a@b.co"}, "", "", regCodeNameTooLong},
		{"name at the limit", registrationRequest{Name: strings.Repeat("a", maxRegistrantNameLen), Email: "a@b.co"}, strings.Repeat("a", maxRegistrantNameLen), "a@b.co", ""},
		{"control character in name", registrationRequest{Name: "Sara\x00Ali", Email: "a@b.co"}, "", "", regCodeNameInvalid},
		{"email without at", registrationRequest{Name: "A", Email: "nope"}, "", "", regCodeEmailInvalid},
		{"email without domain dot", registrationRequest{Name: "A", Email: "a@b"}, "", "", regCodeEmailInvalid},
		{"email with space inside", registrationRequest{Name: "A", Email: "a b@c.co"}, "", "", regCodeEmailInvalid},
		{"empty email", registrationRequest{Name: "A", Email: ""}, "", "", regCodeEmailInvalid},
		{"mailto injection", registrationRequest{Name: "A", Email: "a@b.co?bcc=x@evil.example"}, "", "", regCodeEmailInvalid},
		{"ampersand", registrationRequest{Name: "A", Email: "a@b.co&body=hi"}, "", "", regCodeEmailInvalid},
		{"control character", registrationRequest{Name: "A", Email: "a\x00@b.co"}, "", "", regCodeEmailInvalid},
		{"apostrophe is a real email character", registrationRequest{Name: "A", Email: "o'brien@example.com"}, "A", "o'brien@example.com", ""},
		{"plus addressing", registrationRequest{Name: "A", Email: "me+workshop@example.com"}, "A", "me+workshop@example.com", ""},
		{"email too long", registrationRequest{Name: "A", Email: strings.Repeat("a", 250) + "@b.co"}, "", "", regCodeEmailInvalid},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			name, email, code, message := tc.req.clean()
			if code != tc.wantCode {
				t.Fatalf("code = %q (%s), want %q", code, message, tc.wantCode)
			}
			if code == "" && (name != tc.wantName || email != tc.wantEmail) {
				t.Fatalf("got (%q, %q), want (%q, %q)", name, email, tc.wantName, tc.wantEmail)
			}
		})
	}
}

func TestRegistrationState(t *testing.T) {
	ten, two := 10, 2
	cases := []struct {
		name       string
		isPast     bool
		open       bool
		capacity   *int
		registered int
		wantStatus string
		wantLeft   *int
	}{
		{"open, no limit", false, true, nil, 500, "open", nil},
		{"open with seats", false, true, &ten, 4, "open", intp(6)},
		{"full", false, true, &two, 2, "full", intp(0)},
		{"over capacity never goes negative", false, true, &two, 5, "full", intp(0)},
		{"switched off", false, false, &ten, 1, "closed", intp(9)},
		{"ended wins over everything", true, true, &ten, 1, "ended", intp(9)},
		{"ended and switched off", true, false, nil, 0, "ended", nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			left, status := registrationState(tc.isPast, tc.open, tc.capacity, tc.registered)
			if status != tc.wantStatus {
				t.Fatalf("status = %q, want %q", status, tc.wantStatus)
			}
			switch {
			case tc.wantLeft == nil && left != nil:
				t.Fatalf("spotsLeft = %d, want nil", *left)
			case tc.wantLeft != nil && (left == nil || *left != *tc.wantLeft):
				t.Fatalf("spotsLeft = %v, want %d", left, *tc.wantLeft)
			}
		})
	}
}

func intp(n int) *int { return &n }

func TestCSVSafe(t *testing.T) {
	cases := map[string]string{
		"Sara Ali":                  "Sara Ali",
		"":                          "",
		"=HYPERLINK(\"http://x\")":  "'=HYPERLINK(\"http://x\")",
		"+1 555":                    "'+1 555",
		"-2+3":                      "'-2+3",
		"@SUM(A1)":                  "'@SUM(A1)",
		"\tcmd":                     "'\tcmd",
		"a=b":                       "a=b",
		"سارة":                      "سارة",
		"user+tag@example.com":      "user+tag@example.com",
		"-leading-dash@example.com": "'-leading-dash@example.com",
	}
	for in, want := range cases {
		if got := csvSafe(in); got != want {
			t.Errorf("csvSafe(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestFileSlug(t *testing.T) {
	cases := map[string]string{
		"Intro to Go!":             "intro-to-go",
		"  --  ":                   "workshop",
		"":                         "workshop",
		"ورشة":                     "workshop",
		strings.Repeat("abc ", 30): "abc-abc-abc-abc-abc-abc-abc-abc-abc-abc",
	}
	for in, want := range cases {
		if got := fileSlug(in); got != want {
			t.Errorf("fileSlug(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestWorkshopWriteCapacityValidation(t *testing.T) {
	base := func() workshopWriteRequest {
		return workshopWriteRequest{
			Title:       map[string]string{"en": "T", "ar": "ع"},
			Description: map[string]string{"en": "D", "ar": "و"},
			EventDate:   "2030-01-01",
		}
	}
	zero, neg, ok, huge := 0, -3, 40, maxWorkshopCapacity+1

	for _, tc := range []struct {
		name string
		cap  *int
		fail bool
	}{
		{"none means unlimited", nil, false},
		{"valid", &ok, false},
		{"zero", &zero, true},
		{"negative", &neg, true},
		{"absurd", &huge, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := base()
			req.Capacity = tc.cap
			req.normalize()
			err := req.validate()
			if (err != nil) != tc.fail {
				t.Fatalf("err = %v, want failure = %v", err, tc.fail)
			}
		})
	}

	t.Run("registration defaults to open", func(t *testing.T) {
		req := base()
		req.normalize()
		if req.RegistrationOpen == nil || !*req.RegistrationOpen {
			t.Fatal("omitting registration_open must leave registration open")
		}
	})
}
