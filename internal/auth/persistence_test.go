package auth

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

func TestPersistentStateVersionThreePreservesGuestMigrationHintsUntilRetired(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "accounts.json")
	legacy := []byte(`{
  "version": 3,
  "guestWorkspaceInitialized": true,
  "guestTopologyIds": ["default-map", "guest-map"],
  "guestOrganizationId": "org-guest",
  "users": []
}`)
	if err := os.WriteFile(path, legacy, 0o600); err != nil {
		t.Fatal(err)
	}
	state, exists, migrated, err := loadPersistentState(path)
	if err != nil {
		t.Fatal(err)
	}
	if !exists || !migrated || state.Version != authStateVersion ||
		state.GuestOrganizationID != testGuestOrganizationID ||
		!state.LegacyGuestWorkspaceInitialized ||
		!slices.Equal(state.LegacyGuestTopologyIDs, []string{"default-map", "guest-map"}) {
		t.Fatalf("migrated state = %#v, exists = %v, migrated = %v", state, exists, migrated)
	}
	hints := preflight(state)
	if hints.GuestOrganizationID != testGuestOrganizationID ||
		!slices.Equal(hints.LegacyGuestTopologyIDs, []string{"default-map", "guest-map"}) {
		t.Fatalf("preflight = %#v", hints)
	}
	if !retireLegacyGuestTopologyIDs(&state) || retireLegacyGuestTopologyIDs(&state) {
		t.Fatal("retiring legacy Guest topology IDs was not idempotent")
	}

	if err := savePersistentState(path, state); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path) // #nosec G304 -- path is a test-owned temporary fixture.
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(data, []byte("guestTopologyIds")) ||
		bytes.Contains(data, []byte("guestWorkspaceInitialized")) {
		t.Fatalf("retired Guest allowlist remains persisted: %s", data)
	}
}

func TestPersistentStateVersionOneMigration(t *testing.T) {
	passwordHash, err := hashPassword(testPassword)
	if err != nil {
		t.Fatal(err)
	}
	state := persistentState{Version: 1, Users: []persistedUser{{
		ID: "legacy-user", Username: "Legacy User", UsernameKey: "legacy user",
		Role: RoleUser, PasswordHash: passwordHash, LegacyOrganizations: []string{"Vienna"},
	}}}
	directory := t.TempDir()
	path := filepath.Join(directory, "accounts.json")
	data, err := json.Marshal(state)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	loaded, exists, migrated, err := loadPersistentState(path)
	if err != nil {
		t.Fatal(err)
	}
	if !exists || !migrated || loaded.Version != 2 || loaded.Users[0].AuthSource != AuthSourceLocal {
		t.Fatalf("migrated state = %#v, exists = %v, migrated = %v", loaded, exists, migrated)
	}
	catalog, err := newOrganizationCatalog([]OrganizationRef{{ID: "org-vienna", Name: "Vienna"}})
	if err != nil {
		t.Fatal(err)
	}
	organizationMigrated, err := migrateOrganizationAssignments(&loaded, catalog)
	if err != nil || !organizationMigrated {
		t.Fatalf("organization migration = %v, error = %v", organizationMigrated, err)
	}
	if err := validatePersistentState(loaded, make([]byte, 32), catalog); err != nil {
		t.Fatal(err)
	}
	if err := savePersistentState(path, loaded); err != nil {
		t.Fatal(err)
	}
	reloaded, _, migratedAgain, err := loadPersistentState(path)
	if err != nil {
		t.Fatal(err)
	}
	if migratedAgain || reloaded.Version != authStateVersion || reloaded.Users[0].PasswordHash != passwordHash ||
		len(reloaded.Users[0].LegacyOrganizations) != 0 ||
		len(reloaded.Users[0].OrganizationIDs) != 1 || reloaded.Users[0].OrganizationIDs[0] != "org-vienna" {
		t.Fatalf("durable state = %#v, migrated again = %v", reloaded, migratedAgain)
	}
}

func TestReadPreflight(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	hints, err := ReadPreflight(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(hints.LegacyOrganizationNames) != 0 || hints.GuestOrganizationID != "" ||
		len(hints.LegacyGuestTopologyIDs) != 0 {
		t.Fatalf("missing-state preflight = %#v", hints)
	}
	authDir := filepath.Join(dataDir, "auth")
	if err := os.MkdirAll(authDir, 0o700); err != nil {
		t.Fatal(err)
	}
	state := persistentState{
		Version: 2, GuestOrganizationID: testGuestOrganizationID,
		LegacyGuestTopologyIDs: []string{" guest-map ", "guest-map"}, Users: []persistedUser{
			{LegacyOrganizations: []string{" Vienna ", "Berlin"}},
			{LegacyOrganizations: []string{"vienna"}},
		}}
	data, err := json.Marshal(state)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(authDir, "accounts.json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	hints, err = ReadPreflight(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(hints.LegacyOrganizationNames, []string{"Berlin", "Vienna"}) ||
		hints.GuestOrganizationID != testGuestOrganizationID ||
		!slices.Equal(hints.LegacyGuestTopologyIDs, []string{"guest-map"}) {
		t.Fatalf("preflight = %#v", hints)
	}
}
