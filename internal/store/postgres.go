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

// EnsureOrganizations idempotently creates Default and registers legacy
// organization names which may exist only in authentication state.
func (s *PostgresStore) EnsureOrganizations(ctx context.Context, legacyOrganizationNames []string) error {
	names := make([]string, 0, len(legacyOrganizationNames))
	for _, candidate := range legacyOrganizationNames {
		name, err := normalizeOrganizationName(candidate)
		if err != nil {
			return err
		}
		names = append(names, name)
	}
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			INSERT INTO organizations (id, name, is_default)
			VALUES ($1, $2, true)
			ON CONFLICT (normalized_name) DO NOTHING`,
			model.DefaultOrganizationID, model.DefaultOrganizationName,
		); err != nil {
			return fmt.Errorf("ensuring default organization: %w", err)
		}
		var defaultID string
		var isDefault bool
		if err := tx.QueryRow(ctx, `
			SELECT id::text, is_default
			FROM organizations
			WHERE normalized_name = lower($1)`, model.DefaultOrganizationName,
		).Scan(&defaultID, &isDefault); err != nil {
			return fmt.Errorf("reading default organization: %w", err)
		}
		if defaultID != model.DefaultOrganizationID || !isDefault {
			return fmt.Errorf("%w: default organization identity does not match", ErrConflict)
		}
		for _, name := range names {
			id, err := model.NewID()
			if err != nil {
				return fmt.Errorf("generating organization id: %w", err)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO organizations (id, name)
				VALUES ($1, $2)
				ON CONFLICT (normalized_name) DO NOTHING`, id, name,
			); err != nil {
				return fmt.Errorf("registering legacy organization: %w", err)
			}
		}
		return nil
	})
}

// ListOrganizations returns Default first, followed by names case-insensitively.
func (s *PostgresStore) ListOrganizations(ctx context.Context) ([]Organization, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, name, is_default, created_at, updated_at
		FROM organizations
		ORDER BY is_default DESC, normalized_name, id`)
	if err != nil {
		return nil, fmt.Errorf("listing organizations: %w", err)
	}
	defer rows.Close()
	organizations := []Organization{}
	for rows.Next() {
		organization, err := scanOrganization(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning organization: %w", err)
		}
		organizations = append(organizations, organization)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating organizations: %w", err)
	}
	return organizations, nil
}

// GetOrganization resolves one organization by stable ID.
func (s *PostgresStore) GetOrganization(ctx context.Context, id string) (Organization, error) {
	id, err := validateOrganizationID(id)
	if err != nil {
		return Organization{}, err
	}
	return scanPostgresOrganization(s.pool.QueryRow(ctx, `
		SELECT id::text, name, is_default, created_at, updated_at
		FROM organizations
		WHERE id = $1`, id))
}

// FindOrganizationByName performs a case-insensitive registry lookup.
func (s *PostgresStore) FindOrganizationByName(ctx context.Context, name string) (Organization, error) {
	name, err := normalizeOrganizationName(name)
	if err != nil {
		return Organization{}, err
	}
	return scanPostgresOrganization(s.pool.QueryRow(ctx, `
		SELECT id::text, name, is_default, created_at, updated_at
		FROM organizations
		WHERE normalized_name = lower($1)`, name))
}

// CreateOrganization inserts a new organization with a stable random ID.
func (s *PostgresStore) CreateOrganization(ctx context.Context, name string) (Organization, error) {
	name, err := normalizeOrganizationName(name)
	if err != nil {
		return Organization{}, err
	}
	id, err := model.NewID()
	if err != nil {
		return Organization{}, fmt.Errorf("generating organization id: %w", err)
	}
	organization, err := scanPostgresOrganization(s.pool.QueryRow(ctx, `
		INSERT INTO organizations (id, name)
		VALUES ($1, $2)
		RETURNING id::text, name, is_default, created_at, updated_at`, id, name))
	if isUniqueViolation(err) {
		return Organization{}, ErrConflict
	}
	if err != nil {
		return Organization{}, fmt.Errorf("creating organization: %w", err)
	}
	return organization, nil
}

// RenameOrganization changes only the display name; its stable ID is retained.
func (s *PostgresStore) RenameOrganization(ctx context.Context, id string, name string) (Organization, error) {
	id, err := validateOrganizationID(id)
	if err != nil {
		return Organization{}, err
	}
	name, err = normalizeOrganizationName(name)
	if err != nil {
		return Organization{}, err
	}
	var renamed Organization
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var isDefault bool
		if err := tx.QueryRow(ctx, "SELECT is_default FROM organizations WHERE id = $1 FOR UPDATE", id).
			Scan(&isDefault); errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return fmt.Errorf("locking organization: %w", err)
		}
		if isDefault {
			return ErrProtectedOrganization
		}
		renamed, err = scanPostgresOrganization(tx.QueryRow(ctx, `
			UPDATE organizations
			SET name = $2, updated_at = now()
			WHERE id = $1
			RETURNING id::text, name, is_default, created_at, updated_at`, id, name))
		if isUniqueViolation(err) {
			return ErrConflict
		}
		if err != nil {
			return fmt.Errorf("renaming organization: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE topologies
			SET organization = $2,
				document = jsonb_set(document, '{organization}', to_jsonb($2::text), true)
			WHERE organization_id = $1`, id, renamed.Name,
		); err != nil {
			return fmt.Errorf("updating topology organization names: %w", err)
		}
		return nil
	})
	if err != nil {
		return Organization{}, err
	}
	return renamed, nil
}

// DeleteOrganization removes an unused organization. Default is protected.
func (s *PostgresStore) DeleteOrganization(ctx context.Context, id string) error {
	id, err := validateOrganizationID(id)
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var isDefault bool
		if err := tx.QueryRow(ctx, "SELECT is_default FROM organizations WHERE id = $1 FOR UPDATE", id).
			Scan(&isDefault); errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return fmt.Errorf("locking organization: %w", err)
		}
		if isDefault {
			return ErrProtectedOrganization
		}
		var hasTopologies bool
		if err := tx.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM topologies WHERE organization_id = $1)", id).
			Scan(&hasTopologies); err != nil {
			return fmt.Errorf("checking organization references: %w", err)
		}
		if hasTopologies {
			return ErrOrganizationInUse
		}
		if _, err := tx.Exec(ctx, "DELETE FROM organizations WHERE id = $1", id); err != nil {
			if isForeignKeyViolation(err) {
				return ErrOrganizationInUse
			}
			return fmt.Errorf("deleting organization: %w", err)
		}
		return nil
	})
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
		SELECT topology.id::text, topology.name, organization.id::text, organization.name,
			topology.location, topology.rack_count, topology.device_count,
			topology.link_count, topology.updated_at
		FROM topologies AS topology
		JOIN organizations AS organization ON organization.id = topology.organization_id
		ORDER BY topology.updated_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("listing topologies: %w", err)
	}
	defer rows.Close()

	summaries := []model.Summary{}
	for rows.Next() {
		var summary model.Summary
		if err := rows.Scan(
			&summary.ID, &summary.Name, &summary.OrganizationID, &summary.Organization, &summary.Location,
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
	var organizationID string
	var organizationName string
	err := s.pool.QueryRow(ctx, `
		SELECT topology.document, organization.id::text, organization.name
		FROM topologies AS topology
		JOIN organizations AS organization ON organization.id = topology.organization_id
		WHERE topology.id = $1`, id).Scan(&document, &organizationID, &organizationName)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Topology{}, ErrNotFound
	}
	if err != nil {
		return model.Topology{}, fmt.Errorf("getting topology: %w", err)
	}
	topology, err := decodePostgresTopology(document)
	if err != nil {
		return model.Topology{}, err
	}
	topology.OrganizationID = organizationID
	topology.Organization = organizationName
	return topology, nil
}

// Create validates and inserts a topology.
func (s *PostgresStore) Create(ctx context.Context, topology model.Topology) (model.Topology, error) {
	organization, err := s.GetOrganization(ctx, topology.OrganizationID)
	if err != nil {
		if errors.Is(err, ErrNotFound) || errors.Is(err, ErrInvalid) {
			return model.Topology{}, fmt.Errorf("%w: unknown organization", ErrInvalid)
		}
		return model.Topology{}, fmt.Errorf("resolving topology organization: %w", err)
	}
	topology.OrganizationID = organization.ID
	topology.Organization = organization.Name
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
			id, name, organization_id, organization, location, revision, rack_count,
			device_count, link_count, created_at, updated_at, document
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
		topology.ID, topology.Name, topology.OrganizationID, topology.Organization, topology.Location, topology.Revision,
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
	return s.DeleteAtRevision(ctx, id, 0, nil)
}

// DeleteAtRevision locks, authorizes, and removes one topology transactionally.
// An expected revision of zero disables the optimistic concurrency precondition.
func (s *PostgresStore) DeleteAtRevision(
	ctx context.Context,
	id string,
	expectedRevision uint64,
	authorize func(model.Topology) error,
) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var document []byte
		var actualRevision uint64
		var organizationID string
		var organizationName string
		err := tx.QueryRow(ctx, `
			SELECT topology.document, topology.revision, organization.id::text, organization.name
			FROM topologies AS topology
			JOIN organizations AS organization ON organization.id = topology.organization_id
			WHERE topology.id = $1
			FOR UPDATE OF topology`, id).
			Scan(&document, &actualRevision, &organizationID, &organizationName)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("locking topology for deletion: %w", err)
		}
		if expectedRevision != 0 && actualRevision != expectedRevision {
			return &RevisionConflictError{Expected: expectedRevision, Actual: actualRevision}
		}
		current, err := decodePostgresTopology(document)
		if err != nil {
			return err
		}
		current.OrganizationID = organizationID
		current.Organization = organizationName
		if authorize != nil {
			if err := authorize(current); err != nil {
				return err
			}
		}
		tag, err := tx.Exec(ctx, "DELETE FROM topologies WHERE id = $1 AND revision = $2", id, actualRevision)
		if err != nil {
			return fmt.Errorf("deleting topology: %w", err)
		}
		if tag.RowsAffected() != 1 {
			return &RevisionConflictError{Expected: actualRevision, Actual: actualRevision + 1}
		}
		return nil
	})
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
		var organizationID string
		var organizationName string
		err := tx.QueryRow(ctx, `
			SELECT topology.document, topology.revision, organization.id::text, organization.name
			FROM topologies AS topology
			JOIN organizations AS organization ON organization.id = topology.organization_id
			WHERE topology.id = $1
			FOR UPDATE OF topology`, id).
			Scan(&document, &actualRevision, &organizationID, &organizationName)
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
		current.OrganizationID = organizationID
		current.Organization = organizationName
		next, err := current.Clone()
		if err != nil {
			return fmt.Errorf("copying topology for mutation: %w", err)
		}
		if err := mutation(&next); err != nil {
			return err
		}
		nextOrganization, err := findPostgresOrganizationByID(ctx, tx, next.OrganizationID)
		if err != nil {
			if errors.Is(err, ErrNotFound) || errors.Is(err, ErrInvalid) {
				return fmt.Errorf("%w: unknown organization", ErrInvalid)
			}
			return fmt.Errorf("resolving topology organization: %w", err)
		}
		next.OrganizationID = nextOrganization.ID
		next.Organization = nextOrganization.Name
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
				name = $2, organization_id = $3, organization = $4, location = $5, revision = $6,
				rack_count = $7, device_count = $8, link_count = $9,
				updated_at = $10, document = $11::jsonb
			WHERE id = $1 AND revision = $12`,
			next.ID, next.Name, next.OrganizationID, next.Organization, next.Location, next.Revision,
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

type rowScanner interface {
	Scan(dest ...any) error
}

func scanOrganization(row rowScanner) (Organization, error) {
	var organization Organization
	if err := row.Scan(
		&organization.ID,
		&organization.Name,
		&organization.IsDefault,
		&organization.CreatedAt,
		&organization.UpdatedAt,
	); err != nil {
		return Organization{}, err
	}
	return organization, nil
}

func scanPostgresOrganization(row rowScanner) (Organization, error) {
	organization, err := scanOrganization(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Organization{}, ErrNotFound
	}
	return organization, err
}

func findPostgresOrganizationByID(ctx context.Context, querier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, id string) (Organization, error) {
	id, err := validateOrganizationID(id)
	if err != nil {
		return Organization{}, err
	}
	return scanPostgresOrganization(querier.QueryRow(ctx, `
		SELECT id::text, name, is_default, created_at, updated_at
		FROM organizations
		WHERE id = $1`, id))
}

func isUniqueViolation(err error) bool {
	var postgresErr *pgconn.PgError
	return errors.As(err, &postgresErr) && postgresErr.Code == "23505"
}

func isForeignKeyViolation(err error) bool {
	var postgresErr *pgconn.PgError
	return errors.As(err, &postgresErr) && postgresErr.Code == "23503"
}
