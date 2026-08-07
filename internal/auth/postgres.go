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
	existingTopologyIDs []string,
) (*Manager, error) {
	config.AdminUsername = normalizeUsernameDisplay(config.AdminUsername)
	if config.AdminUsername == "" {
		return nil, errors.New("auth: bootstrap administrator username is required")
	}
	if err := validatePassword(config.AdminPassword); err != nil {
		return nil, fmt.Errorf("bootstrap administrator password: %w", err)
	}
	state, key, migrated, err := loadOrCreatePostgresState(ctx, pool)
	if err != nil {
		return nil, err
	}
	if err := validatePersistentState(state, key); err != nil {
		return nil, err
	}
	if migrated {
		persisted, err := savePostgresMigration(ctx, pool, state, key, 1)
		if err != nil {
			return nil, err
		}
		if !persisted {
			state, key, _, err = loadPostgresState(ctx, pool)
			if err != nil {
				return nil, fmt.Errorf("reloading concurrently migrated authentication state: %w", err)
			}
			if err := validatePersistentState(state, key); err != nil {
				return nil, err
			}
		}
	}
	manager := newManager(state, key, config, func(saveCtx context.Context, next persistentState) error {
		return savePostgresState(saveCtx, pool, next, key)
	})
	if err := manager.preparePasswordComparison(); err != nil {
		return nil, err
	}
	if err := manager.bootstrap(ctx, config, existingTopologyIDs); err != nil {
		return nil, err
	}
	return manager, nil
}

func loadOrCreatePostgresState(ctx context.Context, pool *pgxpool.Pool) (persistentState, []byte, bool, error) {
	state, key, migrated, err := loadPostgresState(ctx, pool)
	if err == nil {
		return state, key, migrated, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return persistentState{}, nil, false, err
	}
	key = make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return persistentState{}, nil, false, fmt.Errorf("generating authentication encryption key: %w", err)
	}
	state = persistentState{Version: authStateVersion, Users: []persistedUser{}}
	inserted, err := insertInitialPostgresState(ctx, pool, state, key)
	if err != nil {
		return persistentState{}, nil, false, err
	}
	if !inserted {
		return loadPostgresState(ctx, pool)
	}
	return state, key, false, nil
}

func loadPostgresState(ctx context.Context, pool *pgxpool.Pool) (persistentState, []byte, bool, error) {
	var version int
	var document []byte
	var key []byte
	err := pool.QueryRow(ctx, `
		SELECT version, document, encryption_key
		FROM auth_state
		WHERE singleton`).Scan(&version, &document, &key)
	if err != nil {
		return persistentState{}, nil, false, err
	}
	if version < 1 || version > authStateVersion {
		return persistentState{}, nil, false, fmt.Errorf("auth: unsupported state version %d", version)
	}
	if len(key) != 32 {
		return persistentState{}, nil, false, errors.New("auth: encryption key must contain exactly 32 bytes")
	}
	var state persistentState
	decoder := json.NewDecoder(bytes.NewReader(document))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&state); err != nil {
		return persistentState{}, nil, false, fmt.Errorf("decoding postgres authentication state: %w", err)
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return persistentState{}, nil, false, errors.New("auth: postgres state contains multiple json values")
	}
	if state.Version != version {
		return persistentState{}, nil, false, errors.New("auth: postgres state version does not match its document")
	}
	migrated, err := migratePersistentState(&state)
	if err != nil {
		return persistentState{}, nil, false, err
	}
	if state.Users == nil {
		state.Users = []persistedUser{}
	}
	return state, key, migrated, nil
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
