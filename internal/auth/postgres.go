package auth

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
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
	state, key, err := loadOrCreatePostgresState(ctx, pool)
	if err != nil {
		return nil, err
	}
	if err := validatePersistentState(state, key); err != nil {
		return nil, err
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

func loadOrCreatePostgresState(ctx context.Context, pool *pgxpool.Pool) (persistentState, []byte, error) {
	state, key, err := loadPostgresState(ctx, pool)
	if err == nil {
		return state, key, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return persistentState{}, nil, err
	}
	key = make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return persistentState{}, nil, fmt.Errorf("generating authentication encryption key: %w", err)
	}
	state = persistentState{Version: authStateVersion, Users: []persistedUser{}}
	if err := savePostgresState(ctx, pool, state, key); err != nil {
		return persistentState{}, nil, err
	}
	return state, key, nil
}

func loadPostgresState(ctx context.Context, pool *pgxpool.Pool) (persistentState, []byte, error) {
	var version int
	var document []byte
	var key []byte
	err := pool.QueryRow(ctx, `
		SELECT version, document, encryption_key
		FROM auth_state
		WHERE singleton`).Scan(&version, &document, &key)
	if err != nil {
		return persistentState{}, nil, err
	}
	if version != authStateVersion {
		return persistentState{}, nil, fmt.Errorf("auth: unsupported state version %d", version)
	}
	if len(key) != 32 {
		return persistentState{}, nil, errors.New("auth: encryption key must contain exactly 32 bytes")
	}
	var state persistentState
	if err := json.Unmarshal(document, &state); err != nil {
		return persistentState{}, nil, fmt.Errorf("decoding postgres authentication state: %w", err)
	}
	if state.Users == nil {
		state.Users = []persistedUser{}
	}
	return state, key, nil
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
