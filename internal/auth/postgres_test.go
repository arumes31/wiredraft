package auth

import (
	"encoding/json"
	"fmt"
	"slices"
	"testing"
)

func TestDecodePostgresStatePreservesLegacyOrganizationNames(t *testing.T) {
	t.Parallel()
	state := persistentState{Version: 1, Users: []persistedUser{{
		ID: "legacy", Role: RoleUser, LegacyOrganizations: []string{"Vienna"},
	}}}
	document, err := json.Marshal(state)
	if err != nil {
		t.Fatal(err)
	}
	decoded, migrated, previousVersion, err := decodePostgresState(1, document, make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	if !migrated || previousVersion != 1 || decoded.Version != 2 ||
		decoded.Users[0].AuthSource != AuthSourceLocal ||
		len(decoded.Users[0].LegacyOrganizations) != 1 || decoded.Users[0].LegacyOrganizations[0] != "Vienna" {
		t.Fatalf("decoded state = %#v, migrated = %v, previous version = %d", decoded, migrated, previousVersion)
	}
}

func TestDecodePostgresStatePreservesVersionThreeGuestMigrationHints(t *testing.T) {
	t.Parallel()
	document := []byte(`{
  "version": 3,
  "guestWorkspaceInitialized": true,
  "guestTopologyIds": ["default-map", "guest-map"],
  "guestOrganizationId": "org-guest",
  "users": []
}`)
	decoded, migrated, previousVersion, err := decodePostgresState(3, document, make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	if !migrated || previousVersion != 3 || decoded.Version != authStateVersion ||
		decoded.GuestOrganizationID != testGuestOrganizationID ||
		!decoded.LegacyGuestWorkspaceInitialized || len(decoded.LegacyGuestTopologyIDs) != 2 {
		t.Fatalf("decoded state = %#v, migrated = %v, previous version = %d", decoded, migrated, previousVersion)
	}
	if !retireLegacyGuestTopologyIDs(&decoded) || decoded.LegacyGuestWorkspaceInitialized ||
		len(decoded.LegacyGuestTopologyIDs) != 0 {
		t.Fatalf("retired state = %#v", decoded)
	}
}

func TestDecodePostgresPreflightSupportsVersionsOneThroughFour(t *testing.T) {
	t.Parallel()
	for version := 1; version <= authStateVersion; version++ {
		t.Run(fmt.Sprintf("version_%d", version), func(t *testing.T) {
			t.Parallel()
			document := []byte(fmt.Sprintf(`{
  "version": %d,
  "guestWorkspaceInitialized": true,
  "guestTopologyIds": ["map-b", "map-a", "map-b"],
  "guestOrganizationId": "org-guest",
  "users": []
}`, version))
			decoded, _, previousVersion, err := decodePostgresState(version, document, make([]byte, 32))
			if err != nil {
				t.Fatal(err)
			}
			hints := preflight(decoded)
			if previousVersion != version || hints.GuestOrganizationID != testGuestOrganizationID ||
				!slices.Equal(hints.LegacyGuestTopologyIDs, []string{"map-a", "map-b"}) {
				t.Fatalf("decoded = %#v, preflight = %#v, previous version = %d", decoded, hints, previousVersion)
			}
		})
	}
}

func TestDecodePostgresStateValidation(t *testing.T) {
	t.Parallel()
	validDocument, err := json.Marshal(persistentState{Version: authStateVersion, Users: []persistedUser{}})
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name     string
		version  int
		document []byte
		key      []byte
	}{
		{name: "unsupported version", version: authStateVersion + 1, document: validDocument, key: make([]byte, 32)},
		{name: "invalid key", version: authStateVersion, document: validDocument, key: make([]byte, 31)},
		{name: "invalid json", version: authStateVersion, document: []byte("{"), key: make([]byte, 32)},
		{name: "unknown field", version: authStateVersion, document: []byte(`{"version":4,"users":[],"unknown":true}`), key: make([]byte, 32)},
		{name: "multiple values", version: authStateVersion, document: append(validDocument, []byte(` {}`)...), key: make([]byte, 32)},
		{name: "version mismatch", version: 2, document: validDocument, key: make([]byte, 32)},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if _, _, _, err := decodePostgresState(test.version, test.document, test.key); err == nil {
				t.Fatal("invalid PostgreSQL auth state was accepted")
			}
		})
	}
}
