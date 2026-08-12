package auth

import (
	"bufio"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"time"
)

const (
	authStateVersion = 4
	maxAuthStateSize = 4 << 20
)

type persistedUser struct {
	ID                       string    `json:"id"`
	Username                 string    `json:"username"`
	UsernameKey              string    `json:"usernameKey"`
	Role                     string    `json:"role"`
	PasswordHash             string    `json:"passwordHash"`
	AuthSource               string    `json:"authSource"`
	ExternalLogin            string    `json:"externalLogin,omitempty"`
	ExternalTenantID         string    `json:"externalTenantId,omitempty"`
	ExternalObjectID         string    `json:"externalObjectId,omitempty"`
	ExternalLinkedAt         time.Time `json:"externalLinkedAt,omitzero"`
	AllOrganizations         bool      `json:"allOrganizations,omitempty"`
	OrganizationIDs          []string  `json:"organizationIds,omitempty"`
	LegacyOrganizations      []string  `json:"organizations,omitempty"`
	EncryptedTOTPSecret      string    `json:"encryptedTotpSecret,omitempty"`
	RecoveryCodeHashes       []string  `json:"recoveryCodeHashes,omitempty"`
	LastTOTPStep             uint64    `json:"lastTotpStep,omitempty"`
	Disabled                 bool      `json:"disabled,omitempty"`
	IsBootstrapAdministrator bool      `json:"isBootstrapAdministrator,omitempty"`
	CreatedAt                time.Time `json:"createdAt"`
	UpdatedAt                time.Time `json:"updatedAt"`
}

type persistentState struct {
	Version             int             `json:"version"`
	GuestOrganizationID string          `json:"guestOrganizationId,omitempty"`
	Users               []persistedUser `json:"users"`

	// Retained only to decode and erase the version 3 Guest topology allowlist.
	LegacyGuestWorkspaceInitialized bool     `json:"guestWorkspaceInitialized,omitempty"`
	LegacyGuestTopologyIDs          []string `json:"guestTopologyIds,omitempty"`
}

func loadOrCreateEncryptionKey(directory string) ([]byte, error) {
	path := filepath.Join(directory, "auth.key")
	// The path is derived only from the operator-controlled data directory and
	// the fixed auth.key filename; it is never influenced by an HTTP request.
	key, err := os.ReadFile(path) // #nosec G304 -- fixed filename below the configured data directory.
	if err == nil {
		if len(key) != 32 {
			return nil, errors.New("auth: encryption key must contain exactly 32 bytes")
		}
		return key, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("reading authentication encryption key: %w", err)
	}
	key = make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("generating authentication encryption key: %w", err)
	}
	if err := writePrivateFile(path, key); err != nil {
		return nil, fmt.Errorf("persisting authentication encryption key: %w", err)
	}
	return key, nil
}

func loadPersistentState(path string) (state persistentState, exists bool, migrated bool, returnErr error) {
	// Manager.New constructs path from the operator-controlled data directory
	// and the fixed accounts.json filename.
	file, err := os.Open(path) // #nosec G304 -- fixed filename below the configured data directory.
	if errors.Is(err, os.ErrNotExist) {
		return persistentState{Version: authStateVersion, Users: []persistedUser{}}, false, false, nil
	}
	if err != nil {
		return persistentState{}, false, false, fmt.Errorf("opening authentication state: %w", err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil && returnErr == nil {
			returnErr = fmt.Errorf("closing authentication state: %w", closeErr)
		}
	}()
	decoder := json.NewDecoder(io.LimitReader(file, maxAuthStateSize))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&state); err != nil {
		return persistentState{}, false, false, fmt.Errorf("decoding authentication state: %w", err)
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return persistentState{}, false, false, errors.New("auth: state contains multiple json values")
		}
		return persistentState{}, false, false, fmt.Errorf("checking authentication state: %w", err)
	}
	migrated, err = migratePersistentState(&state)
	if err != nil {
		return persistentState{}, false, false, err
	}
	if state.Users == nil {
		state.Users = []persistedUser{}
	}
	return state, true, migrated, nil
}

func migratePersistentState(state *persistentState) (bool, error) {
	changed := false
	switch state.Version {
	case 1:
		for index := range state.Users {
			state.Users[index].AuthSource = AuthSourceLocal
		}
		state.Version = 2
		changed = true
	case 2:
	case 3:
		state.Version = authStateVersion
		changed = true
	case authStateVersion:
	default:
		return false, fmt.Errorf("auth: unsupported state version %d", state.Version)
	}
	return changed, nil
}

func retireLegacyGuestTopologyIDs(state *persistentState) bool {
	if !state.LegacyGuestWorkspaceInitialized && len(state.LegacyGuestTopologyIDs) == 0 {
		return false
	}
	state.LegacyGuestWorkspaceInitialized = false
	state.LegacyGuestTopologyIDs = nil
	return true
}

func savePersistentState(path string, state persistentState) (returnErr error) {
	state.Version = authStateVersion
	temporary, err := os.CreateTemp(filepath.Dir(path), "accounts-*.tmp")
	if err != nil {
		return fmt.Errorf("creating temporary authentication state: %w", err)
	}
	temporaryName := temporary.Name()
	isClosed := false
	defer func() {
		if !isClosed {
			if closeErr := temporary.Close(); closeErr != nil && returnErr == nil {
				returnErr = fmt.Errorf("closing temporary authentication state: %w", closeErr)
			}
		}
		if returnErr != nil {
			_ = os.Remove(temporaryName)
		}
	}()
	if err := temporary.Chmod(0o600); err != nil {
		return fmt.Errorf("setting authentication state permissions: %w", err)
	}
	buffered := bufio.NewWriterSize(temporary, 32<<10)
	encoder := json.NewEncoder(buffered)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(state); err != nil {
		return fmt.Errorf("encoding authentication state: %w", err)
	}
	if err := buffered.Flush(); err != nil {
		return fmt.Errorf("flushing authentication state: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return fmt.Errorf("synchronizing authentication state: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("closing authentication state before rename: %w", err)
	}
	isClosed = true
	if err := os.Rename(temporaryName, path); err != nil {
		return fmt.Errorf("atomically replacing authentication state: %w", err)
	}
	return nil
}

func writePrivateFile(path string, data []byte) (returnErr error) {
	temporary, err := os.CreateTemp(filepath.Dir(path), "secret-*.tmp")
	if err != nil {
		return err
	}
	temporaryName := temporary.Name()
	isClosed := false
	defer func() {
		if !isClosed {
			if closeErr := temporary.Close(); closeErr != nil && returnErr == nil {
				returnErr = closeErr
			}
		}
		if returnErr != nil {
			_ = os.Remove(temporaryName)
		}
	}()
	if err := temporary.Chmod(0o600); err != nil {
		return err
	}
	if _, err := temporary.Write(data); err != nil {
		return err
	}
	if err := temporary.Sync(); err != nil {
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	isClosed = true
	return os.Rename(temporaryName, path)
}

func sealSecret(key []byte, value string) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("creating secret cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating secret envelope: %w", err)
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generating secret nonce: %w", err)
	}
	sealed := aead.Seal(nonce, nonce, []byte(value), nil)
	return base64.RawStdEncoding.EncodeToString(sealed), nil
}

func openSecret(key []byte, encoded string) (string, error) {
	sealed, err := base64.RawStdEncoding.DecodeString(encoded)
	if err != nil {
		return "", errors.New("auth: invalid encrypted secret")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("creating secret cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating secret envelope: %w", err)
	}
	if len(sealed) < aead.NonceSize() {
		return "", errors.New("auth: encrypted secret is too short")
	}
	plaintext, err := aead.Open(nil, sealed[:aead.NonceSize()], sealed[aead.NonceSize():], nil)
	if err != nil {
		return "", errors.New("auth: decrypting secret failed")
	}
	return string(plaintext), nil
}

func clonePersistentState(state persistentState) persistentState {
	clone := state
	clone.Users = make([]persistedUser, len(state.Users))
	for index, user := range state.Users {
		user.OrganizationIDs = slices.Clone(user.OrganizationIDs)
		user.LegacyOrganizations = slices.Clone(user.LegacyOrganizations)
		user.RecoveryCodeHashes = slices.Clone(user.RecoveryCodeHashes)
		clone.Users[index] = user
	}
	return clone
}
