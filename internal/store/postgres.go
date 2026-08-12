package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"wiredraft/internal/model"
)

// PostgresStore persists complete topology aggregates in PostgreSQL JSONB rows.
type PostgresStore struct {
	pool *pgxpool.Pool
}

var _ Store = (*PostgresStore)(nil)

// NewPostgresStore creates a PostgreSQL-backed topology store.
func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

// Ping verifies that PostgreSQL is reachable for readiness checks.
func (s *PostgresStore) Ping(ctx context.Context) error {
	if err := s.pool.Ping(ctx); err != nil {
		return fmt.Errorf("pinging topology database: %w", err)
	}
	return nil
}

// EnsureDemo creates the initial demonstration topology when the database is empty.
func (s *PostgresStore) EnsureDemo(ctx context.Context) error {
	var count int
	if err := s.pool.QueryRow(ctx, "SELECT count(*) FROM topologies").Scan(&count); err != nil {
		return fmt.Errorf("counting topologies: %w", err)
	}
	if count != 0 {
		return nil
	}
	demo, err := model.NewDemo()
	if err != nil {
		return fmt.Errorf("creating demo topology: %w", err)
	}
	if _, err := s.Create(ctx, demo); err != nil && !errors.Is(err, ErrConflict) {
		return fmt.Errorf("persisting demo topology: %w", err)
	}
	return nil
}

// List returns summaries ordered by most recent update.
func (s *PostgresStore) List(ctx context.Context) ([]model.Summary, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, name, organization, location, rack_count, device_count, link_count, updated_at
		FROM topologies
		ORDER BY updated_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("listing topologies: %w", err)
	}
	defer rows.Close()

	summaries := []model.Summary{}
	for rows.Next() {
		var summary model.Summary
		if err := rows.Scan(
			&summary.ID, &summary.Name, &summary.Organization, &summary.Location,
			&summary.RackCount, &summary.DeviceCount, &summary.LinkCount, &summary.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning topology summary: %w", err)
		}
		summaries = append(summaries, summary)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating topology summaries: %w", err)
	}
	return summaries, nil
}

// Get returns one validated topology snapshot.
func (s *PostgresStore) Get(ctx context.Context, id string) (model.Topology, error) {
	var document []byte
	err := s.pool.QueryRow(ctx, "SELECT document FROM topologies WHERE id = $1", id).Scan(&document)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Topology{}, ErrNotFound
	}
	if err != nil {
		return model.Topology{}, fmt.Errorf("getting topology: %w", err)
	}
	return decodePostgresTopology(document)
}

// Create validates and inserts a topology.
func (s *PostgresStore) Create(ctx context.Context, topology model.Topology) (model.Topology, error) {
	topology.Normalize()
	if err := topology.Validate(); err != nil {
		return model.Topology{}, fmt.Errorf("%w: %w", ErrInvalid, err)
	}
	document, err := json.Marshal(topology)
	if err != nil {
		return model.Topology{}, fmt.Errorf("encoding topology: %w", err)
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO topologies (
			id, name, organization, location, revision, rack_count, device_count,
			link_count, created_at, updated_at, document
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
		topology.ID, topology.Name, topology.Organization, topology.Location, topology.Revision,
		len(topology.Racks), topology.LogicalDeviceCount(), len(topology.Links),
		topology.CreatedAt, topology.UpdatedAt, document,
	)
	if isUniqueViolation(err) {
		return model.Topology{}, ErrConflict
	}
	if err != nil {
		return model.Topology{}, fmt.Errorf("creating topology: %w", err)
	}
	return topology.Clone()
}

// Delete removes one topology aggregate.
func (s *PostgresStore) Delete(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, "DELETE FROM topologies WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("deleting topology: %w", err)
	}
	if tag.RowsAffected() != 1 {
		return ErrNotFound
	}
	return nil
}

// Mutate applies a mutation without an optimistic revision precondition.
func (s *PostgresStore) Mutate(
	ctx context.Context,
	id string,
	mutation func(*model.Topology) error,
) (model.Topology, error) {
	return s.MutateAtRevision(ctx, id, 0, mutation)
}

// MutateAtRevision locks, validates, and replaces one topology in a transaction.
func (s *PostgresStore) MutateAtRevision(
	ctx context.Context,
	id string,
	expectedRevision uint64,
	mutation func(*model.Topology) error,
) (model.Topology, error) {
	var updated model.Topology
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var document []byte
		var actualRevision uint64
		err := tx.QueryRow(ctx, "SELECT document, revision FROM topologies WHERE id = $1 FOR UPDATE", id).
			Scan(&document, &actualRevision)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("locking topology: %w", err)
		}
		if expectedRevision != 0 && actualRevision != expectedRevision {
			return &RevisionConflictError{Expected: expectedRevision, Actual: actualRevision}
		}
		current, err := decodePostgresTopology(document)
		if err != nil {
			return err
		}
		next, err := current.Clone()
		if err != nil {
			return fmt.Errorf("copying topology for mutation: %w", err)
		}
		if err := mutation(&next); err != nil {
			return err
		}
		next.Revision = actualRevision + 1
		next.UpdatedAt = time.Now().UTC()
		next.Normalize()
		if err := next.Validate(); err != nil {
			return fmt.Errorf("%w: %w", ErrInvalid, err)
		}
		nextDocument, err := json.Marshal(next)
		if err != nil {
			return fmt.Errorf("encoding topology: %w", err)
		}
		tag, err := tx.Exec(ctx, `
			UPDATE topologies SET
				name = $2, organization = $3, location = $4, revision = $5,
				rack_count = $6, device_count = $7, link_count = $8,
				updated_at = $9, document = $10::jsonb
			WHERE id = $1 AND revision = $11`,
			next.ID, next.Name, next.Organization, next.Location, next.Revision,
			len(next.Racks), next.LogicalDeviceCount(), len(next.Links), next.UpdatedAt,
			nextDocument, actualRevision,
		)
		if err != nil {
			return fmt.Errorf("updating topology: %w", err)
		}
		if tag.RowsAffected() != 1 {
			return &RevisionConflictError{Expected: actualRevision, Actual: actualRevision + 1}
		}
		updated = next
		return nil
	})
	if err != nil {
		return model.Topology{}, err
	}
	return updated.Clone()
}

func decodePostgresTopology(document []byte) (model.Topology, error) {
	var topology model.Topology
	if err := json.Unmarshal(document, &topology); err != nil {
		return model.Topology{}, fmt.Errorf("decoding topology: %w", err)
	}
	if err := topology.Validate(); err != nil {
		return model.Topology{}, fmt.Errorf("validating stored topology: %w", err)
	}
	return topology, nil
}

func isUniqueViolation(err error) bool {
	var postgresErr *pgconn.PgError
	return errors.As(err, &postgresErr) && postgresErr.Code == "23505"
}
