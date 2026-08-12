package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	migrationComplete := false
	for range 3 {
		organizationMigrated, err := migrateOrganizationAssignments(&state, catalog)
		if err != nil {
			return nil, err
		}
		guestMigrated, err := migrateGuestOrganization(&state, catalog, config.GuestEnabled)
		if err != nil {
			return nil, err
		}
		guestAllowlistRetired := retireLegacyGuestTopologyIDs(&state)
		if err := validatePersistentState(state, key, catalog); err != nil {
			return nil, err
		}
		if !schemaMigrated && !organizationMigrated && !guestMigrated && !guestAllowlistRetired {
			migrationComplete = true
			break
		}
		persisted := true
		if previousVersion < authStateVersion {
			persisted, err = savePostgresMigration(ctx, pool, state, key, previousVersion)
		} else {
			err = savePostgresState(ctx, pool, state, key)
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
	manager := newManager(state, key, config, catalog, func(saveCtx context.Context, next persistentState) error {
		return savePostgresState(saveCtx, pool, next, key)
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

func normalizeUsernameDisplay(value string) string {
	return strings.TrimSpace(value)
}
