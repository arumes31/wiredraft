package store

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"slices"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
	migratepgx "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"wiredraft/internal/model"
)

const migrationDirectory = "migrations"

const (
	initialMigrationVersion      = 1
	organizationMigrationVersion = 2
)

type migrationSchemaState uint8

const (
	migrationSchemaUnknown migrationSchemaState = iota
	migrationSchemaEmpty
	migrationSchemaInitial
	migrationSchemaOrganizations
)

type migrationColumn struct {
	dataType  string
	nullable  bool
	generated bool
}

type migrationSchemaInspection struct {
	tables                map[string]map[string]migrationColumn
	constraints           map[string]string
	indexes               map[string]struct{}
	organizationDataValid bool
}

var initialTopologyColumns = map[string]migrationColumn{
	"id":           {dataType: "uuid"},
	"name":         {dataType: "text"},
	"organization": {dataType: "text"},
	"location":     {dataType: "text"},
	"revision":     {dataType: "int8"},
	"rack_count":   {dataType: "int4"},
	"device_count": {dataType: "int4"},
	"link_count":   {dataType: "int4"},
	"created_at":   {dataType: "timestamptz"},
	"updated_at":   {dataType: "timestamptz"},
	"document":     {dataType: "jsonb"},
}

var authStateColumns = map[string]migrationColumn{
	"singleton":      {dataType: "bool"},
	"version":        {dataType: "int4"},
	"document":       {dataType: "jsonb"},
	"encryption_key": {dataType: "bytea"},
	"updated_at":     {dataType: "timestamptz"},
}

var organizationColumns = map[string]migrationColumn{
	"id":              {dataType: "uuid"},
	"name":            {dataType: "text"},
	"normalized_name": {dataType: "text", nullable: true, generated: true},
	"is_default":      {dataType: "bool"},
	"created_at":      {dataType: "timestamptz"},
	"updated_at":      {dataType: "timestamptz"},
}

var initialMigrationConstraints = map[string]string{
	"topologies.topologies_pkey":                 "PRIMARY KEY",
	"topologies.topologies_revision_check":       "CHECK",
	"topologies.topologies_rack_count_check":     "CHECK",
	"topologies.topologies_device_count_check":   "CHECK",
	"topologies.topologies_link_count_check":     "CHECK",
	"auth_state.auth_state_pkey":                 "PRIMARY KEY",
	"auth_state.auth_state_singleton_check":      "CHECK",
	"auth_state.auth_state_encryption_key_check": "CHECK",
}

var organizationMigrationConstraints = map[string]string{
	"organizations.organizations_pkey":                "PRIMARY KEY",
	"organizations.organizations_normalized_name_key": "UNIQUE",
	"organizations.organizations_default_name_check":  "CHECK",
	"topologies.topologies_organization_id_fkey":      "FOREIGN KEY",
}

var initialMigrationIndexes = []string{
	"topologies.topologies_updated_at_idx",
	"topologies.topologies_organization_idx",
}

var organizationMigrationIndexes = []string{
	"organizations.organizations_one_default_idx",
	"topologies.topologies_organization_id_idx",
}

//go:embed migrations/*.sql
var migrationFiles embed.FS

// MigrateDatabase applies every pending embedded schema migration. It is safe
// to call on each startup; concurrent callers coordinate through PostgreSQL's
// advisory-lock implementation in the migration driver.
func MigrateDatabase(pool *pgxpool.Pool) error {
	runErr, closeErr := runMigrationUp(pool)
	if closeErr != nil {
		return errors.Join(wrapMigrationRunError(runErr), closeErr)
	}
	if runErr == nil {
		return nil
	}
	var dirty migrate.ErrDirty
	if !errors.As(runErr, &dirty) {
		return wrapMigrationRunError(runErr)
	}
	if err := recoverDirtyMigration(pool, dirty.Version); err != nil {
		return fmt.Errorf("applying database migrations: %w", err)
	}
	runErr, closeErr = runMigrationUp(pool)
	if runErr != nil {
		runErr = fmt.Errorf("retrying after recovering dirty migration %d: %w", dirty.Version, runErr)
	}
	return errors.Join(wrapMigrationRunError(runErr), closeErr)
}

func runMigrationUp(pool *pgxpool.Pool) (runErr error, closeErr error) {
	migrator, err := newMigrator(pool)
	if err != nil {
		return err, nil
	}
	runErr = migrator.Up()
	if errors.Is(runErr, migrate.ErrNoChange) {
		runErr = nil
	}
	sourceErr, databaseErr := migrator.Close()
	if sourceErr != nil {
		closeErr = errors.Join(closeErr, fmt.Errorf("closing migration source: %w", sourceErr))
	}
	if databaseErr != nil {
		closeErr = errors.Join(closeErr, fmt.Errorf("closing migration database: %w", databaseErr))
	}
	return runErr, closeErr
}

func wrapMigrationRunError(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("applying database migrations: %w", err)
}

func recoverDirtyMigration(pool *pgxpool.Pool, observedVersion int) (returnErr error) {
	ctx := context.Background()
	connection, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquiring dirty migration recovery connection: %w", err)
	}
	defer connection.Release()
	return recoverDirtyMigrationOnConnection(ctx, connection, observedVersion)
}

type migrationRecoveryConnection interface {
	migrationSchemaQuerier
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

func recoverDirtyMigrationOnConnection(
	ctx context.Context,
	connection migrationRecoveryConnection,
	observedVersion int,
) (returnErr error) {
	var databaseName string
	var schemaName string
	if err := connection.QueryRow(ctx, "SELECT current_database(), current_schema()").
		Scan(&databaseName, &schemaName); err != nil {
		return fmt.Errorf("resolving dirty migration lock identity: %w", err)
	}
	lockID, err := database.GenerateAdvisoryLockId(
		databaseName, schemaName, migratepgx.DefaultMigrationsTable,
	)
	if err != nil {
		return fmt.Errorf("generating dirty migration lock identity: %w", err)
	}
	if _, err := connection.Exec(ctx, "SELECT pg_advisory_lock($1)", lockID); err != nil {
		return fmt.Errorf("locking dirty migration recovery: %w", err)
	}
	defer func() {
		var unlocked bool
		unlockErr := connection.QueryRow(ctx, "SELECT pg_advisory_unlock($1)", lockID).Scan(&unlocked)
		if unlockErr == nil && !unlocked {
			unlockErr = errors.New("dirty migration recovery advisory lock was not held")
		}
		if unlockErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("unlocking dirty migration recovery: %w", unlockErr))
		}
	}()

	migrationsTable := pgx.Identifier{schemaName, migratepgx.DefaultMigrationsTable}.Sanitize()
	var currentVersion int
	var dirty bool
	var rowCount int64
	metadataErr := connection.QueryRow(ctx, fmt.Sprintf(`
		SELECT version, dirty, count(*) OVER ()
		FROM %s
		LIMIT 1`, migrationsTable)).Scan(&currentVersion, &dirty, &rowCount)
	if errors.Is(metadataErr, pgx.ErrNoRows) {
		inspection, err := inspectMigrationSchema(ctx, connection, schemaName)
		if err != nil {
			return fmt.Errorf("inspecting migration state without metadata: %w", err)
		}
		if classifyMigrationSchema(inspection) != migrationSchemaEmpty {
			return errors.New("refusing to recover missing migration metadata for a non-empty schema")
		}
		return nil // Another startup reset a rolled-back first migration to the nil version.
	}
	if metadataErr != nil {
		return fmt.Errorf("reading dirty migration state: %w", metadataErr)
	}
	if rowCount != 1 {
		return fmt.Errorf("refusing to recover migration metadata with %d rows", rowCount)
	}
	if !dirty {
		return nil // A concurrent startup recovered the database before this lock was acquired.
	}

	inspection, err := inspectMigrationSchema(ctx, connection, schemaName)
	if err != nil {
		return fmt.Errorf("inspecting dirty migration %d: %w", currentVersion, err)
	}
	forceVersion, err := classifyDirtyMigrationRecovery(currentVersion, classifyMigrationSchema(inspection))
	if err != nil {
		if currentVersion != observedVersion {
			return fmt.Errorf("dirty migration changed from %d to %d while waiting for recovery: %w",
				observedVersion, currentVersion, err)
		}
		return err
	}

	var tag pgconn.CommandTag
	if forceVersion == database.NilVersion {
		tag, err = connection.Exec(ctx, fmt.Sprintf(
			"DELETE FROM %s WHERE version = $1 AND dirty", migrationsTable,
		), currentVersion)
	} else {
		tag, err = connection.Exec(ctx, fmt.Sprintf(`
			UPDATE %s
			SET version = $1, dirty = false
			WHERE version = $2 AND dirty`, migrationsTable), forceVersion, currentVersion)
	}
	if err != nil {
		return fmt.Errorf("resetting dirty migration %d to version %d: %w", currentVersion, forceVersion, err)
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("dirty migration %d changed during recovery", currentVersion)
	}
	return nil
}

func classifyDirtyMigrationRecovery(dirtyVersion int, state migrationSchemaState) (int, error) {
	switch dirtyVersion {
	case initialMigrationVersion:
		switch state {
		case migrationSchemaEmpty:
			return database.NilVersion, nil
		case migrationSchemaInitial:
			return initialMigrationVersion, nil
		}
	case organizationMigrationVersion:
		switch state {
		case migrationSchemaInitial:
			return initialMigrationVersion, nil
		case migrationSchemaOrganizations:
			return organizationMigrationVersion, nil
		}
	default:
		return 0, fmt.Errorf("refusing to recover unknown dirty migration version %d", dirtyVersion)
	}
	return 0, fmt.Errorf("refusing to recover dirty migration %d from partial or unrecognized schema state", dirtyVersion)
}

type migrationSchemaQuerier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func inspectMigrationSchema(
	ctx context.Context,
	querier migrationSchemaQuerier,
	schemaName string,
) (migrationSchemaInspection, error) {
	inspection := migrationSchemaInspection{
		tables:      make(map[string]map[string]migrationColumn),
		constraints: make(map[string]string),
		indexes:     make(map[string]struct{}),
	}
	rows, err := querier.Query(ctx, `
		SELECT column_info.table_name, column_info.column_name, column_info.udt_name,
			column_info.is_nullable = 'YES', column_info.is_generated = 'ALWAYS'
		FROM information_schema.columns AS column_info
		JOIN information_schema.tables AS table_info
			ON table_info.table_schema = column_info.table_schema
			AND table_info.table_name = column_info.table_name
			AND table_info.table_type = 'BASE TABLE'
		WHERE column_info.table_schema = $1
			AND column_info.table_name = ANY($2)
		ORDER BY column_info.table_name, column_info.ordinal_position`,
		schemaName, []string{"topologies", "auth_state", "organizations"},
	)
	if err != nil {
		return migrationSchemaInspection{}, fmt.Errorf("reading migration table columns: %w", err)
	}
	for rows.Next() {
		var tableName string
		var columnName string
		var column migrationColumn
		if err := rows.Scan(&tableName, &columnName, &column.dataType, &column.nullable, &column.generated); err != nil {
			rows.Close()
			return migrationSchemaInspection{}, fmt.Errorf("scanning migration table column: %w", err)
		}
		if inspection.tables[tableName] == nil {
			inspection.tables[tableName] = make(map[string]migrationColumn)
		}
		inspection.tables[tableName][columnName] = column
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return migrationSchemaInspection{}, fmt.Errorf("iterating migration table columns: %w", err)
	}
	rows.Close()

	rows, err = querier.Query(ctx, `
		SELECT table_name, constraint_name, constraint_type
		FROM information_schema.table_constraints
		WHERE table_schema = $1 AND table_name = ANY($2)`,
		schemaName, []string{"topologies", "auth_state", "organizations"},
	)
	if err != nil {
		return migrationSchemaInspection{}, fmt.Errorf("reading migration table constraints: %w", err)
	}
	for rows.Next() {
		var tableName string
		var constraintName string
		var constraintType string
		if err := rows.Scan(&tableName, &constraintName, &constraintType); err != nil {
			rows.Close()
			return migrationSchemaInspection{}, fmt.Errorf("scanning migration table constraint: %w", err)
		}
		inspection.constraints[tableName+"."+constraintName] = constraintType
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return migrationSchemaInspection{}, fmt.Errorf("iterating migration table constraints: %w", err)
	}
	rows.Close()

	rows, err = querier.Query(ctx, `
		SELECT tablename, indexname
		FROM pg_indexes
		WHERE schemaname = $1 AND tablename = ANY($2)`,
		schemaName, []string{"topologies", "auth_state", "organizations"},
	)
	if err != nil {
		return migrationSchemaInspection{}, fmt.Errorf("reading migration table indexes: %w", err)
	}
	for rows.Next() {
		var tableName string
		var indexName string
		if err := rows.Scan(&tableName, &indexName); err != nil {
			rows.Close()
			return migrationSchemaInspection{}, fmt.Errorf("scanning migration table index: %w", err)
		}
		inspection.indexes[tableName+"."+indexName] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return migrationSchemaInspection{}, fmt.Errorf("iterating migration table indexes: %w", err)
	}
	rows.Close()

	if hasOrganizationMigrationShape(inspection) {
		var defaultDataValid bool
		var topologyDataValid bool
		if err := querier.QueryRow(ctx, `
			SELECT
				EXISTS (
					SELECT 1 FROM organizations
					WHERE id = $1 AND name = $2 AND is_default
				) AND (SELECT count(*) FROM organizations WHERE is_default) = 1,
				NOT EXISTS (
					SELECT 1
					FROM topologies AS topology
					LEFT JOIN organizations AS organization ON organization.id = topology.organization_id
					WHERE organization.id IS NULL
						OR topology.organization IS DISTINCT FROM organization.name
						OR topology.document->>'organizationId' IS DISTINCT FROM organization.id::text
						OR topology.document->>'organization' IS DISTINCT FROM organization.name
				)`, model.DefaultOrganizationID, model.DefaultOrganizationName,
		).Scan(&defaultDataValid, &topologyDataValid); err != nil {
			return migrationSchemaInspection{}, fmt.Errorf("validating organization migration data: %w", err)
		}
		inspection.organizationDataValid = defaultDataValid && topologyDataValid
	}
	return inspection, nil
}

func classifyMigrationSchema(inspection migrationSchemaInspection) migrationSchemaState {
	if len(inspection.tables) == 0 {
		return migrationSchemaEmpty
	}
	if !columnsEqual(inspection.tables["auth_state"], authStateColumns) ||
		!hasEntries(inspection.constraints, initialMigrationConstraints) ||
		!hasIndexes(inspection.indexes, initialMigrationIndexes) {
		return migrationSchemaUnknown
	}
	if columnsEqual(inspection.tables["topologies"], initialTopologyColumns) &&
		inspection.tables["organizations"] == nil {
		return migrationSchemaInitial
	}
	if hasOrganizationMigrationShape(inspection) && inspection.organizationDataValid {
		return migrationSchemaOrganizations
	}
	return migrationSchemaUnknown
}

func hasOrganizationMigrationShape(inspection migrationSchemaInspection) bool {
	topologyColumns := make(map[string]migrationColumn, len(initialTopologyColumns)+1)
	for name, column := range initialTopologyColumns {
		topologyColumns[name] = column
	}
	topologyColumns["organization_id"] = migrationColumn{dataType: "uuid"}
	return columnsEqual(inspection.tables["topologies"], topologyColumns) &&
		columnsEqual(inspection.tables["auth_state"], authStateColumns) &&
		columnsEqual(inspection.tables["organizations"], organizationColumns) &&
		hasEntries(inspection.constraints, initialMigrationConstraints) &&
		hasEntries(inspection.constraints, organizationMigrationConstraints) &&
		hasIndexes(inspection.indexes, initialMigrationIndexes) &&
		hasIndexes(inspection.indexes, organizationMigrationIndexes)
}

func columnsEqual(actual map[string]migrationColumn, expected map[string]migrationColumn) bool {
	if len(actual) != len(expected) {
		return false
	}
	for name, expectedColumn := range expected {
		if actual[name] != expectedColumn {
			return false
		}
	}
	return true
}

func hasEntries(actual map[string]string, expected map[string]string) bool {
	for name, expectedType := range expected {
		if actual[name] != expectedType {
			return false
		}
	}
	return true
}

func hasIndexes(actual map[string]struct{}, expected []string) bool {
	return !slices.ContainsFunc(expected, func(name string) bool {
		_, exists := actual[name]
		return !exists
	})
}

func newMigrator(pool *pgxpool.Pool) (*migrate.Migrate, error) {
	sourceDriver, err := newMigrationSource()
	if err != nil {
		return nil, err
	}

	databaseHandle := stdlib.OpenDBFromPool(pool)
	databaseDriver, err := migratepgx.WithInstance(databaseHandle, &migratepgx.Config{})
	if err != nil {
		return nil, errors.Join(
			fmt.Errorf("opening migration database: %w", err),
			closeMigrationSource(sourceDriver),
			closeMigrationDatabaseHandle(databaseHandle),
		)
	}

	migrator, err := migrate.NewWithInstance("iofs", sourceDriver, "pgx5", databaseDriver)
	if err != nil {
		return nil, errors.Join(
			fmt.Errorf("creating migration runner: %w", err),
			closeMigrationSource(sourceDriver),
			closeMigrationDatabase(databaseDriver),
		)
	}
	return migrator, nil
}

func newMigrationSource() (source.Driver, error) {
	driver, err := iofs.New(migrationFiles, migrationDirectory)
	if err != nil {
		return nil, fmt.Errorf("opening embedded database migrations: %w", err)
	}
	return driver, nil
}

func closeMigrationSource(driver source.Driver) error {
	if err := driver.Close(); err != nil {
		return fmt.Errorf("closing migration source: %w", err)
	}
	return nil
}

func closeMigrationDatabase(driver database.Driver) error {
	if err := driver.Close(); err != nil {
		return fmt.Errorf("closing migration database: %w", err)
	}
	return nil
}

func closeMigrationDatabaseHandle(handle *sql.DB) error {
	if err := handle.Close(); err != nil {
		return fmt.Errorf("closing migration database handle: %w", err)
	}
	return nil
}
