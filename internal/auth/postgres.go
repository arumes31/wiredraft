package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"

	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPostgres opens authentication state stored in PostgreSQL and synchronizes
// the environment-controlled bootstrap administrator.
func NewPostgres(
	ctx context.Context,
	pool *pgxpool.Pool,
	config Config,
	organizations []OrganizationRef,
) (*Manager, error) {
	config.AdminUsername = normalizeUsernameDisplay(config.AdminUsername)
	if config.AdminUsername == "" {
		return nil, errors.New("auth: bootstrap administrator username is required")
	}
	if err := validatePassword(config.AdminPassword); err != nil {
		return nil, fmt.Errorf("bootstrap administrator password: %w", err)
	}
	catalog, err := newOrganizationCatalog(organizations)
	if err != nil {
		return nil, err
	}
	state, key, schemaMigrated, previousVersion, err := loadOrCreatePostgresState(ctx, pool)
	if err != nil {
		return nil, err
	}
	// columnKey is what the auth_state row stores. Once an external secret key
	// is configured it is only random filler, so a database dump alone no
	// longer opens the TOTP secrets.
	columnKey := key
	secretKey := key
	migrationComplete := false
	for range 3 {
		var rekeyed bool
		secretKey, rekeyed, err = applyExternalSecretKey(&state, key, config.SecretKey, config.PreviousSecretKeys)
		if err != nil {
			return nil, err
		}
		columnKey = key
		if rekeyed {
			columnKey = make([]byte, 32)
			if _, err := rand.Read(columnKey); err != nil {
				return nil, fmt.Errorf("generating authentication key filler: %w", err)
			}
		}
		organizationMigrated, err := migrateOrganizationAssignments(&state, catalog)
		if err != nil {
			return nil, err
		}
		guestMigrated, err := migrateGuestOrganization(&state, catalog, config.GuestEnabled)
		if err != nil {
			return nil, err
		}
		guestAllowlistRetired := retireLegacyGuestTopologyIDs(&state)
		if err := validatePersistentState(state, secretKey, catalog); err != nil {
			return nil, err
		}
		if !schemaMigrated && !organizationMigrated && !guestMigrated && !guestAllowlistRetired && !rekeyed {
			migrationComplete = true
			break
		}
		persisted := true
		if previousVersion < authStateVersion {
			persisted, err = savePostgresMigration(ctx, pool, state, columnKey, previousVersion)
		} else {
			err = savePostgresState(ctx, pool, state, columnKey)
		}
		if err != nil {
			return nil, err
		}
		if persisted {
			migrationComplete = true
			break
		}
		state, key, schemaMigrated, previousVersion, err = loadPostgresState(ctx, pool)
		if err != nil {
			return nil, fmt.Errorf("reloading concurrently migrated authentication state: %w", err)
		}
	}
	if !migrationComplete || state.Version != authStateVersion {
		return nil, errors.New("auth: authentication state migration did not converge")
	}
	manager := newManager(state, secretKey, config, catalog, func(saveCtx context.Context, next persistentState) error {
		return savePostgresState(saveCtx, pool, next, columnKey)
	})
	if err := manager.preparePasswordComparison(); err != nil {
		return nil, err
	}
	if err := manager.bootstrap(ctx, config); err != nil {
		return nil, err
	}
	return manager, nil
}

// ReadPostgresPreflight reads organization state required before NewPostgres
// can migrate to a stable catalog.
func ReadPostgresPreflight(ctx context.Context, pool *pgxpool.Pool) (Preflight, error) {
	state, _, _, _, err := loadPostgresState(ctx, pool)
	if errors.Is(err, pgx.ErrNoRows) {
		return Preflight{LegacyOrganizationNames: []string{}}, nil
	}
	if err != nil {
		return Preflight{}, err
	}
	return preflight(state), nil
}

func loadOrCreatePostgresState(
	ctx context.Context,
	pool *pgxpool.Pool,
) (persistentState, []byte, bool, int, error) {
	state, key, migrated, previousVersion, err := loadPostgresState(ctx, pool)
	if err == nil {
		return state, key, migrated, previousVersion, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return persistentState{}, nil, false, 0, err
	}
	key = make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return persistentState{}, nil, false, 0, fmt.Errorf("generating authentication encryption key: %w", err)
	}
	state = persistentState{Version: authStateVersion, Users: []persistedUser{}}
	inserted, err := insertInitialPostgresState(ctx, pool, state, key)
	if err != nil {
		return persistentState{}, nil, false, 0, err
	}
	if !inserted {
		return loadPostgresState(ctx, pool)
	}
	return state, key, false, authStateVersion, nil
}

func loadPostgresState(
	ctx context.Context,
	pool *pgxpool.Pool,
) (persistentState, []byte, bool, int, error) {
	var version int
	var document []byte
	var key []byte
	err := pool.QueryRow(ctx, `
		SELECT version, document, encryption_key
		FROM auth_state
		WHERE singleton`).Scan(&version, &document, &key)
	if err != nil {
		return persistentState{}, nil, false, 0, err
	}
	state, migrated, previousVersion, err := decodePostgresState(version, document, key)
	if err != nil {
		return persistentState{}, nil, false, 0, err
	}
	return state, key, migrated, previousVersion, nil
}

func decodePostgresState(
	version int,
	document []byte,
	key []byte,
) (persistentState, bool, int, error) {
	if version < 1 || version > authStateVersion {
		return persistentState{}, false, 0, fmt.Errorf("auth: unsupported state version %d", version)
	}
	if len(key) != 32 {
		return persistentState{}, false, 0, errors.New("auth: encryption key must contain exactly 32 bytes")
	}
	var state persistentState
	decoder := json.NewDecoder(bytes.NewReader(document))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&state); err != nil {
		return persistentState{}, false, 0, fmt.Errorf("decoding postgres authentication state: %w", err)
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return persistentState{}, false, 0, errors.New("auth: postgres state contains multiple json values")
	}
	if state.Version != version {
		return persistentState{}, false, 0, errors.New("auth: postgres state version does not match its document")
	}
	previousVersion := version
	migrated, err := migratePersistentState(&state)
	if err != nil {
		return persistentState{}, false, 0, err
	}
	if state.Users == nil {
		state.Users = []persistedUser{}
	}
	return state, migrated, previousVersion, nil
}

func insertInitialPostgresState(ctx context.Context, pool *pgxpool.Pool, state persistentState, key []byte) (bool, error) {
	document, err := json.Marshal(state)
	if err != nil {
		return false, fmt.Errorf("encoding initial authentication state: %w", err)
	}
	result, err := pool.Exec(ctx, `
		INSERT INTO auth_state (singleton, version, document, encryption_key, updated_at)
		VALUES (true, $1, $2::jsonb, $3, $4)
		ON CONFLICT (singleton) DO NOTHING`, authStateVersion, document, key, time.Now().UTC())
	if err != nil {
		return false, fmt.Errorf("creating postgres authentication state: %w", err)
	}
	return result.RowsAffected() == 1, nil
}

func savePostgresMigration(
	ctx context.Context,
	pool *pgxpool.Pool,
	state persistentState,
	key []byte,
	previousVersion int,
) (bool, error) {
	document, err := json.Marshal(state)
	if err != nil {
		return false, fmt.Errorf("encoding migrated authentication state: %w", err)
	}
	result, err := pool.Exec(ctx, `
		UPDATE auth_state
		SET version = $1, document = $2::jsonb, encryption_key = $3, updated_at = $4
		WHERE singleton AND version = $5`, authStateVersion, document, key, time.Now().UTC(), previousVersion)
	if err != nil {
		return false, fmt.Errorf("persisting migrated authentication state: %w", err)
	}
	return result.RowsAffected() == 1, nil
}

func savePostgresState(
	ctx context.Context,
	pool *pgxpool.Pool,
	state persistentState,
	key []byte,
) error {
	state.Version = authStateVersion
	document, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("encoding authentication state: %w", err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO auth_state (singleton, version, document, encryption_key, updated_at)
		VALUES (true, $1, $2::jsonb, $3, $4)
		ON CONFLICT (singleton) DO UPDATE SET
			version = EXCLUDED.version,
			document = EXCLUDED.document,
			encryption_key = EXCLUDED.encryption_key,
			updated_at = EXCLUDED.updated_at`,
		authStateVersion, document, key, time.Now().UTC(),
	)
	if err != nil {
		return fmt.Errorf("persisting postgres authentication state: %w", err)
	}
	return nil
}

// ParseSecretKey decodes an operator-supplied 32-byte key given as base64 or
// hexadecimal text.
func ParseSecretKey(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if len(value) == 64 {
		if key, err := hex.DecodeString(value); err == nil {
			return key, nil
		}
	}
	for _, encoding := range []*base64.Encoding{
		base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding,
	} {
		if key, err := encoding.DecodeString(value); err == nil && len(key) == 32 {
			return key, nil
		}
	}
	return nil, errors.New("auth: secret key must be 32 bytes encoded as base64 or hexadecimal")
}

// applyExternalSecretKey re-seals TOTP secrets with the operator-supplied key.
// Secrets sealed with the database-stored key (before migration) or with a
// previous operator key (during rotation) are opened and re-sealed. It reports
// the key that now seals the secrets and whether the state changed.
func applyExternalSecretKey(
	state *persistentState,
	storedKey []byte,
	externalKey []byte,
	previousKeys [][]byte,
) ([]byte, bool, error) {
	if len(externalKey) == 0 {
		if state.ExternalSecretKey {
			return nil, false, errors.New(
				"auth: TOTP secrets are sealed with an external key; set WIREDRAFT_AUTH_SECRET_KEY_FILE",
			)
		}
		return storedKey, false, nil
	}
	if len(externalKey) != 32 {
		return nil, false, errors.New("auth: external secret key must contain exactly 32 bytes")
	}
	candidates := slices.Clone(previousKeys)
	if !state.ExternalSecretKey {
		candidates = append([][]byte{storedKey}, candidates...)
	}
	changed := !state.ExternalSecretKey
	for index := range state.Users {
		sealed := state.Users[index].EncryptedTOTPSecret
		if sealed == "" {
			continue
		}
		owner := state.Users[index].ID
		if _, err := openSecret(externalKey, sealed, owner); err == nil {
			continue
		}
		opened := false
		for _, candidate := range candidates {
			secret, err := openSecret(candidate, sealed, owner)
			if err != nil {
				continue
			}
			resealed, err := sealSecret(externalKey, secret, owner)
			if err != nil {
				return nil, false, err
			}
			state.Users[index].EncryptedTOTPSecret = resealed
			opened, changed = true, true
			break
		}
		if !opened {
			return nil, false, errors.New("auth: a TOTP secret cannot be opened with the configured secret keys")
		}
	}
	state.ExternalSecretKey = true
	return externalKey, changed, nil
}

func normalizeUsernameDisplay(value string) string {
	return strings.TrimSpace(value)
}
