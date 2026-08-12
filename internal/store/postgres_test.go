package store

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"wiredraft/internal/model"
)

func TestDecodePostgresTopology(t *testing.T) {
	t.Parallel()
	topology, err := model.NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	document, err := json.Marshal(topology)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := decodePostgresTopology(document)
	if err != nil {
		t.Fatal(err)
	}
	if decoded.ID != topology.ID || decoded.Revision != topology.Revision {
		t.Fatalf("decoded identity = %s rev %d, want %s rev %d", decoded.ID, decoded.Revision, topology.ID, topology.Revision)
	}
}

func TestDecodePostgresTopologyRejectsInvalidDocument(t *testing.T) {
	t.Parallel()
	if _, err := decodePostgresTopology([]byte(`{"id":"not-a-uuid"}`)); err == nil {
		t.Fatal("decodePostgresTopology() accepted an invalid topology")
	}
}

func TestIsUniqueViolation(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{name: "postgres unique violation", err: &pgconn.PgError{Code: "23505"}, expected: true},
		{name: "other postgres error", err: &pgconn.PgError{Code: "23503"}, expected: false},
		{name: "ordinary error", err: errors.New("test error"), expected: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if actual := isUniqueViolation(test.err); actual != test.expected {
				t.Fatalf("isUniqueViolation() = %t, want %t", actual, test.expected)
			}
		})
	}
}
