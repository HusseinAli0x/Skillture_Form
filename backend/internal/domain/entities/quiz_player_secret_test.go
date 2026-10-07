package entities

import "testing"

func TestVerifySecret(t *testing.T) {
	secret, hash, err := NewPlayerSecret()
	if err != nil {
		t.Fatal(err)
	}
	if secret == hash || len(hash) != 64 {
		t.Fatalf("hash %q must be a 64-char digest distinct from the secret", hash)
	}

	p := &QuizPlayer{SecretHash: &hash}
	cases := []struct {
		name      string
		presented string
		want      bool
	}{
		{"the issued secret", secret, true},
		{"a different secret", "not-the-secret", false},
		{"nothing presented", "", false},
		{"the hash itself is not the secret", hash, false},
	}
	for _, tc := range cases {
		if got := p.VerifySecret(tc.presented); got != tc.want {
			t.Errorf("%s: VerifySecret = %v, want %v", tc.name, got, tc.want)
		}
	}
}

// Players stored before migration 0011 have no secret; a game running during
// the upgrade must keep working.
func TestVerifySecretAcceptsPlayersWithoutOne(t *testing.T) {
	legacy := &QuizPlayer{}
	if !legacy.VerifySecret("") || !legacy.VerifySecret("anything") {
		t.Fatal("a player with no stored secret must be accepted")
	}
}

func TestNewPlayerSecretIsUnique(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		s, _, err := NewPlayerSecret()
		if err != nil || len(s) < 30 {
			t.Fatalf("secret %q, err %v", s, err)
		}
		if seen[s] {
			t.Fatal("duplicate secret")
		}
		seen[s] = true
	}
}
