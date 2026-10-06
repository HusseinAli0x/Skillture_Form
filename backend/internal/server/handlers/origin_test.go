package handlers

import (
	"fmt"
	"net/http"
	"testing"
)

func TestOriginChecker(t *testing.T) {
	allowed := []string{"http://localhost:5173"}
	req := func(origin, host string) *http.Request {
		r, _ := http.NewRequest(http.MethodGet, "http://"+host+"/ws/sessions/x/host", nil)
		r.Host = host
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		return r
	}
	tests := []struct {
		name   string
		allow  []string
		origin string
		host   string
		want   bool
	}{
		{"no Origin header (not a browser)", allowed, "", "api:8080", true},
		{"listed origin", allowed, "http://localhost:5173", "api:8080", true},
		{"same origin, unlisted (LAN IP)", allowed, "http://192.168.1.20:5173", "192.168.1.20:5173", true},
		{"same origin, unlisted (production domain)", allowed, "https://skillture.example", "skillture.example", true},
		{"same origin ignores case", allowed, "https://Skillture.Example", "skillture.example", true},
		{"foreign site", allowed, "https://evil.example", "skillture.example", false},
		{"same hostname, different port is a different origin", allowed, "http://skillture.example:9999", "skillture.example", false},
		{"unparseable origin", allowed, "://nope", "skillture.example", false},
		{"wildcard allows anything", []string{"*"}, "https://evil.example", "skillture.example", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := originChecker(tt.allow)(req(tt.origin, tt.host)); got != tt.want {
				t.Fatalf("originChecker = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestLANAddressesArePrivateIPv4(t *testing.T) {
	for _, ip := range lanIPv4Addresses() {
		var a, b, c, d int
		if _, err := fmt.Sscanf(ip, "%d.%d.%d.%d", &a, &b, &c, &d); err != nil {
			t.Fatalf("%q is not a dotted IPv4 address", ip)
		}
		private := a == 10 || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168)
		if !private {
			t.Errorf("%s is not a private address", ip)
		}
	}
}
