package auth

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestPersistentStateVersionOneMigration(t *testing.T) {
	passwordHash, err := hashPassword(testPassword)
	if err != nil {
		t.Fatal(err)
	}
	state := persistentState{Version: 1, Users: []persistedUser{{
		ID: "legacy-user", Username: "Legacy User", UsernameKey: "legacy user",
		Role: RoleUser, PasswordHash: passwordHash,
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
	if !exists || !migrated || loaded.Version != authStateVersion || loaded.Users[0].AuthSource != AuthSourceLocal {
		t.Fatalf("migrated state = %#v, exists = %v, migrated = %v", loaded, exists, migrated)
	}
	if err := validatePersistentState(loaded, make([]byte, 32)); err != nil {
		t.Fatal(err)
	}
	if err := savePersistentState(path, loaded); err != nil {
		t.Fatal(err)
	}
	reloaded, _, migratedAgain, err := loadPersistentState(path)
	if err != nil {
		t.Fatal(err)
	}
	if migratedAgain || reloaded.Version != authStateVersion || reloaded.Users[0].PasswordHash != passwordHash {
		t.Fatalf("durable state = %#v, migrated again = %v", reloaded, migratedAgain)
	}
}
