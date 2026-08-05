package database

import (
	"strings"
	"testing"
)

// The embedded set is what actually ships, so these assertions guard the real
// files rather than a fixture.

func TestLoadMigrations(t *testing.T) {
	migrations, err := loadMigrations()
	if err != nil {
		t.Fatalf("loadMigrations: %v", err)
	}
	if len(migrations) == 0 {
		t.Fatal("no migrations embedded; the go:embed pattern matched nothing")
	}

	// Numeric ordering, not lexical: 0010 must follow 0009, which it would not
	// if versions stayed strings.
	for i := 1; i < len(migrations); i++ {
		if migrations[i-1].version >= migrations[i].version {
			t.Errorf("out of order: %s (%d) before %s (%d)",
				migrations[i-1].name, migrations[i-1].version,
				migrations[i].name, migrations[i].version)
		}
	}

	if migrations[0].version != 1 {
		t.Errorf("first migration is version %d, want 1", migrations[0].version)
	}

	for _, m := range migrations {
		if strings.TrimSpace(m.sql) == "" {
			t.Errorf("%s is empty", m.name)
		}
	}
}

func TestBaselineIsIdempotent(t *testing.T) {
	migrations, err := loadMigrations()
	if err != nil {
		t.Fatalf("loadMigrations: %v", err)
	}

	// Databases created before migrations existed already hold every object in
	// the baseline, because schema.sql used to be mounted into
	// docker-entrypoint-initdb.d. Applying 0001 to one of those must record
	// version 1 and change nothing, not fail on "relation already exists".
	baseline := migrations[0].sql
	for _, statement := range []string{"CREATE TABLE", "CREATE INDEX", "CREATE UNIQUE INDEX", "CREATE EXTENSION"} {
		for _, line := range strings.Split(baseline, "\n") {
			trimmed := strings.TrimSpace(line)
			if !strings.HasPrefix(trimmed, statement) {
				continue
			}
			// CREATE UNIQUE INDEX also matches the CREATE INDEX prefix check
			// below it, which is harmless — both need IF NOT EXISTS.
			if !strings.Contains(trimmed, "IF NOT EXISTS") {
				t.Errorf("baseline statement is not idempotent: %s", trimmed)
			}
		}
	}
}

func TestParseVersion(t *testing.T) {
	tests := []struct {
		filename string
		want     int64
		wantErr  bool
	}{
		{filename: "0001_baseline.up.sql", want: 1},
		{filename: "0042_add_indexes.up.sql", want: 42},
		{filename: "10_no_padding.up.sql", want: 10},
		{filename: "0000_zero.up.sql", wantErr: true},
		{filename: "-1_negative.up.sql", wantErr: true},
		{filename: "baseline.up.sql", wantErr: true},
		{filename: "v1_prefixed.up.sql", wantErr: true},
	}

	for _, tc := range tests {
		got, err := parseVersion(tc.filename)
		if tc.wantErr {
			if err == nil {
				t.Errorf("parseVersion(%q) = %d, want an error", tc.filename, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("parseVersion(%q): %v", tc.filename, err)
			continue
		}
		if got != tc.want {
			t.Errorf("parseVersion(%q) = %d, want %d", tc.filename, got, tc.want)
		}
	}
}
