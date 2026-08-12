package store

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

//go:embed testdata/migrations/*.json
var migrationFixtures embed.FS

func TestEmbeddedMigrations(t *testing.T) {
	t.Parallel()
	source, err := newMigrationSource()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := closeMigrationSource(source); err != nil {
			t.Errorf("closing migration source: %v", err)
		}
	})

	version, err := source.First()
	if err != nil {
		t.Fatal(err)
	}
	if version != 1 {
		t.Fatalf("first migration version = %d, want 1", version)
	}

	reader, identifier, err := source.ReadUp(version)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := reader.Close(); err != nil {
			t.Errorf("closing migration: %v", err)
		}
	})
	document, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	if identifier != "initial" {
		t.Fatalf("migration identifier = %q, want %q", identifier, "initial")
	}
	for _, table := range []string{"topologies", "auth_state"} {
		if !strings.Contains(string(document), "CREATE TABLE IF NOT EXISTS "+table) {
			t.Errorf("migration does not create %s", table)
		}
	}

	organizationVersion, err := source.Next(version)
	if err != nil {
		t.Fatal(err)
	}
	if organizationVersion != 2 {
		t.Fatalf("organization migration version = %d, want 2", organizationVersion)
	}
	organizationReader, organizationIdentifier, err := source.ReadUp(organizationVersion)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := organizationReader.Close(); err != nil {
			t.Errorf("closing organization migration: %v", err)
		}
	})
	organizationDocument, err := io.ReadAll(organizationReader)
	if err != nil {
		t.Fatal(err)
	}
	if organizationIdentifier != "organizations" {
		t.Fatalf("organization migration identifier = %q, want organizations", organizationIdentifier)
	}
	for _, invariant := range []string{
		"CREATE TABLE organizations",
		"ALTER COLUMN organization_id SET NOT NULL",
		"FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT",
		"'00000000-0000-4000-8000-000000000000', 'Default', true",
		"jsonb_set",
	} {
		if !strings.Contains(string(organizationDocument), invariant) {
			t.Errorf("organization migration does not contain %q", invariant)
		}
	}
}

func TestClassifyDirtyMigrationRecovery(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name         string
		dirtyVersion int
		schemaState  migrationSchemaState
		wantVersion  int
		wantError    bool
	}{
		{name: "initial rolled back", dirtyVersion: 1, schemaState: migrationSchemaEmpty, wantVersion: database.NilVersion},
		{name: "initial committed", dirtyVersion: 1, schemaState: migrationSchemaInitial, wantVersion: 1},
		{name: "organizations rolled back", dirtyVersion: 2, schemaState: migrationSchemaInitial, wantVersion: 1},
		{name: "organizations committed", dirtyVersion: 2, schemaState: migrationSchemaOrganizations, wantVersion: 2},
		{name: "initial partial", dirtyVersion: 1, schemaState: migrationSchemaUnknown, wantError: true},
		{name: "initial metadata contradicts newer schema", dirtyVersion: 1, schemaState: migrationSchemaOrganizations, wantError: true},
		{name: "organizations missing initial schema", dirtyVersion: 2, schemaState: migrationSchemaEmpty, wantError: true},
		{name: "unknown migration", dirtyVersion: 3, schemaState: migrationSchemaOrganizations, wantError: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			version, err := classifyDirtyMigrationRecovery(test.dirtyVersion, test.schemaState)
			if test.wantError {
				if err == nil {
					t.Fatalf("classifyDirtyMigrationRecovery(%d, %d) returned version %d, want error",
						test.dirtyVersion, test.schemaState, version)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if version != test.wantVersion {
				t.Fatalf("classifyDirtyMigrationRecovery(%d, %d) = %d, want %d",
					test.dirtyVersion, test.schemaState, version, test.wantVersion)
			}
		})
	}
}

func TestClassifyMigrationSchema(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		inspection migrationSchemaInspection
		want       migrationSchemaState
	}{
		{name: "empty", inspection: migrationSchemaInspection{}, want: migrationSchemaEmpty},
		{name: "initial", inspection: initialMigrationInspection(), want: migrationSchemaInitial},
		{name: "organizations", inspection: organizationMigrationInspection(true), want: migrationSchemaOrganizations},
		{name: "organizations with invalid data", inspection: organizationMigrationInspection(false), want: migrationSchemaUnknown},
		{name: "partial organization table", inspection: partialOrganizationMigrationInspection(), want: migrationSchemaUnknown},
		{name: "unexpected topology column", inspection: initialMigrationInspectionWithExtraColumn(), want: migrationSchemaUnknown},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := classifyMigrationSchema(test.inspection); got != test.want {
				t.Fatalf("classifyMigrationSchema() = %d, want %d", got, test.want)
			}
		})
	}
}

func TestInspectMigrationSchema(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		inspection migrationSchemaInspection
		want       migrationSchemaState
	}{
		{name: "initial", inspection: initialMigrationInspection(), want: migrationSchemaInitial},
		{name: "organizations", inspection: organizationMigrationInspection(true), want: migrationSchemaOrganizations},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			connection := &scriptedMigrationConnection{
				queryResults: inspectionQueryResults(test.inspection),
			}
			if test.want == migrationSchemaOrganizations {
				connection.rowResults = []scriptedMigrationRow{{values: []any{true, true}}}
			}
			inspection, err := inspectMigrationSchema(t.Context(), connection, "public")
			if err != nil {
				t.Fatal(err)
			}
			if got := classifyMigrationSchema(inspection); got != test.want {
				t.Fatalf("classifyMigrationSchema() = %d, want %d", got, test.want)
			}
			if len(connection.queries) != 3 || !strings.Contains(connection.queries[0], "AS column_info") {
				t.Fatalf("schema inspection queries = %#v", connection.queries)
			}
			connection.assertConsumed(t)
		})
	}
}

func TestInspectMigrationSchemaFailures(t *testing.T) {
	t.Parallel()
	queryErr := errors.New("query failed")
	rowErr := errors.New("row failed")
	validEmpty := scriptedMigrationRows{}
	validInitial := inspectionQueryResults(initialMigrationInspection())
	validOrganizations := inspectionQueryResults(organizationMigrationInspection(true))
	tests := []struct {
		name       string
		queries    []scriptedMigrationRows
		rowResults []scriptedMigrationRow
		want       string
	}{
		{name: "columns query", queries: []scriptedMigrationRows{{err: queryErr}}, want: "reading migration table columns"},
		{
			name: "columns scan", queries: []scriptedMigrationRows{{values: [][]any{{"topologies"}}, scanErr: rowErr}},
			want: "scanning migration table column",
		},
		{name: "columns iteration", queries: []scriptedMigrationRows{{rowsErr: rowErr}}, want: "iterating migration table columns"},
		{name: "constraints query", queries: []scriptedMigrationRows{validEmpty, {err: queryErr}}, want: "reading migration table constraints"},
		{
			name: "constraints scan", queries: []scriptedMigrationRows{validEmpty, {values: [][]any{{"topologies"}}, scanErr: rowErr}},
			want: "scanning migration table constraint",
		},
		{name: "constraints iteration", queries: []scriptedMigrationRows{validEmpty, {rowsErr: rowErr}}, want: "iterating migration table constraints"},
		{name: "indexes query", queries: []scriptedMigrationRows{validEmpty, validEmpty, {err: queryErr}}, want: "reading migration table indexes"},
		{
			name: "indexes scan", queries: []scriptedMigrationRows{validEmpty, validEmpty, {values: [][]any{{"topologies"}}, scanErr: rowErr}},
			want: "scanning migration table index",
		},
		{name: "indexes iteration", queries: []scriptedMigrationRows{validEmpty, validEmpty, {rowsErr: rowErr}}, want: "iterating migration table indexes"},
		{
			name: "organization data", queries: validOrganizations,
			rowResults: []scriptedMigrationRow{{err: rowErr}}, want: "validating organization migration data",
		},
		{
			name: "initial schema skips organization data", queries: validInitial,
			want: "",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			connection := &scriptedMigrationConnection{
				queryResults: slices.Clone(test.queries),
				rowResults:   slices.Clone(test.rowResults),
			}
			_, err := inspectMigrationSchema(t.Context(), connection, "public")
			if test.want == "" {
				if err != nil {
					t.Fatal(err)
				}
				connection.assertConsumed(t)
				return
			}
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("error = %v, want message containing %q", err, test.want)
			}
		})
	}
}

func TestRecoverDirtyMigrationOnConnection(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name            string
		observedVersion int
		rowResults      []scriptedMigrationRow
		inspection      migrationSchemaInspection
		mutationTag     string
		wantMutation    string
	}{
		{
			name: "rolled back initial migration", observedVersion: 1,
			rowResults: []scriptedMigrationRow{
				{values: []any{"wiredraft", "public"}},
				{values: []any{1, true, int64(1)}},
				{values: []any{true}},
			},
			inspection: migrationSchemaInspection{}, mutationTag: "DELETE 1", wantMutation: "DELETE FROM",
		},
		{
			name: "committed organization migration", observedVersion: 2,
			rowResults: []scriptedMigrationRow{
				{values: []any{"wiredraft", "public"}},
				{values: []any{2, true, int64(1)}},
				{values: []any{true, true}},
				{values: []any{true}},
			},
			inspection: organizationMigrationInspection(true), mutationTag: "UPDATE 1", wantMutation: "UPDATE",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			connection := &scriptedMigrationConnection{
				queryResults: inspectionQueryResults(test.inspection),
				rowResults:   slices.Clone(test.rowResults),
				execResults: []scriptedMigrationExec{
					{tag: "SELECT 1"},
					{tag: test.mutationTag},
				},
			}
			if err := recoverDirtyMigrationOnConnection(t.Context(), connection, test.observedVersion); err != nil {
				t.Fatal(err)
			}
			if len(connection.executes) != 2 || !strings.Contains(connection.executes[1], test.wantMutation) {
				t.Fatalf("recovery statements = %#v", connection.executes)
			}
			connection.assertConsumed(t)
		})
	}
}

func TestRecoverDirtyMigrationOnConnectionConcurrentStates(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name         string
		metadata     scriptedMigrationRow
		inspection   *migrationSchemaInspection
		unlockResult scriptedMigrationRow
		want         string
	}{
		{
			name: "nil version with empty schema", metadata: scriptedMigrationRow{err: pgx.ErrNoRows},
			inspection: &migrationSchemaInspection{}, unlockResult: scriptedMigrationRow{values: []any{true}},
		},
		{
			name: "already clean", metadata: scriptedMigrationRow{values: []any{2, false, int64(1)}},
			unlockResult: scriptedMigrationRow{values: []any{true}},
		},
		{
			name: "missing metadata with schema", metadata: scriptedMigrationRow{err: pgx.ErrNoRows},
			inspection:   ptrMigrationInspection(initialMigrationInspection()),
			unlockResult: scriptedMigrationRow{values: []any{true}}, want: "non-empty schema",
		},
		{
			name: "duplicate metadata", metadata: scriptedMigrationRow{values: []any{2, true, int64(2)}},
			unlockResult: scriptedMigrationRow{values: []any{true}}, want: "metadata with 2 rows",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			connection := &scriptedMigrationConnection{
				rowResults: []scriptedMigrationRow{
					{values: []any{"wiredraft", "public"}}, test.metadata, test.unlockResult,
				},
				execResults: []scriptedMigrationExec{{tag: "SELECT 1"}},
			}
			if test.inspection != nil {
				connection.queryResults = inspectionQueryResults(*test.inspection)
			}
			err := recoverDirtyMigrationOnConnection(t.Context(), connection, 2)
			if test.want == "" {
				if err != nil {
					t.Fatal(err)
				}
			} else if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("error = %v, want message containing %q", err, test.want)
			}
			connection.assertConsumed(t)
		})
	}
}

func TestRecoverDirtyMigrationOnConnectionFailures(t *testing.T) {
	t.Parallel()
	testErr := errors.New("test failure")
	tests := []struct {
		name            string
		observedVersion int
		connection      *scriptedMigrationConnection
		want            string
	}{
		{
			name: "lock identity query",
			connection: &scriptedMigrationConnection{
				rowResults: []scriptedMigrationRow{{err: testErr}},
			},
			want: "resolving dirty migration lock identity",
		},
		{
			name: "advisory lock",
			connection: &scriptedMigrationConnection{
				rowResults:  []scriptedMigrationRow{{values: []any{"wiredraft", "public"}}},
				execResults: []scriptedMigrationExec{{err: testErr}},
			},
			want: "locking dirty migration recovery",
		},
		{
			name: "advisory unlock not held",
			connection: &scriptedMigrationConnection{
				rowResults: []scriptedMigrationRow{
					{values: []any{"wiredraft", "public"}},
					{values: []any{2, false, int64(1)}},
					{values: []any{false}},
				},
				execResults: []scriptedMigrationExec{{tag: "SELECT 1"}},
			},
			want: "advisory lock was not held",
		},
		{
			name: "advisory unlock query",
			connection: &scriptedMigrationConnection{
				rowResults: []scriptedMigrationRow{
					{values: []any{"wiredraft", "public"}},
					{values: []any{2, false, int64(1)}},
					{err: testErr},
				},
				execResults: []scriptedMigrationExec{{tag: "SELECT 1"}},
			},
			want: "unlocking dirty migration recovery",
		},
		{
			name: "metadata query",
			connection: &scriptedMigrationConnection{
				rowResults: []scriptedMigrationRow{
					{values: []any{"wiredraft", "public"}},
					{err: testErr},
					{values: []any{true}},
				},
				execResults: []scriptedMigrationExec{{tag: "SELECT 1"}},
			},
			want: "reading dirty migration state",
		},
		{
			name: "nil version inspection",
			connection: &scriptedMigrationConnection{
				queryResults: []scriptedMigrationRows{{err: testErr}},
				rowResults: []scriptedMigrationRow{
					{values: []any{"wiredraft", "public"}},
					{err: pgx.ErrNoRows},
					{values: []any{true}},
				},
				execResults: []scriptedMigrationExec{{tag: "SELECT 1"}},
			},
			want: "inspecting migration state without metadata",
		},
		{
			name: "dirty schema inspection",
			connection: &scriptedMigrationConnection{
				queryResults: []scriptedMigrationRows{{err: testErr}},
				rowResults: []scriptedMigrationRow{
					{values: []any{"wiredraft", "public"}},
					{values: []any{2, true, int64(1)}},
					{values: []any{true}},
				},
				execResults: []scriptedMigrationExec{{tag: "SELECT 1"}},
			},
			want: "inspecting dirty migration 2",
		},
		{
			name:            "unrecognized schema",
			connection:      recoveryConnectionForDirtyInspection(2, migrationSchemaInspection{}),
			observedVersion: 2,
			want:            "partial or unrecognized schema state",
		},
		{
			name:            "dirty version changed",
			connection:      recoveryConnectionForDirtyInspection(2, migrationSchemaInspection{}),
			observedVersion: 1,
			want:            "dirty migration changed from 1 to 2",
		},
		{
			name:            "metadata reset",
			connection:      recoveryConnectionForReset(2, initialMigrationInspection(), scriptedMigrationExec{err: testErr}),
			observedVersion: 2,
			want:            "resetting dirty migration 2 to version 1",
		},
		{
			name:            "metadata changed during reset",
			connection:      recoveryConnectionForReset(2, initialMigrationInspection(), scriptedMigrationExec{tag: "UPDATE 0"}),
			observedVersion: 2,
			want:            "dirty migration 2 changed during recovery",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			err := recoverDirtyMigrationOnConnection(t.Context(), test.connection, test.observedVersion)
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("error = %v, want message containing %q", err, test.want)
			}
			test.connection.assertConsumed(t)
		})
	}
}

func TestWrapMigrationRunError(t *testing.T) {
	t.Parallel()
	if err := wrapMigrationRunError(nil); err != nil {
		t.Fatalf("wrapMigrationRunError(nil) = %v", err)
	}
	testErr := errors.New("test failure")
	if err := wrapMigrationRunError(testErr); !errors.Is(err, testErr) ||
		!strings.Contains(err.Error(), "applying database migrations") {
		t.Fatalf("wrapMigrationRunError() = %v", err)
	}
}

func ptrMigrationInspection(inspection migrationSchemaInspection) *migrationSchemaInspection {
	return &inspection
}

func recoveryConnectionForReset(
	version int,
	inspection migrationSchemaInspection,
	reset scriptedMigrationExec,
) *scriptedMigrationConnection {
	connection := recoveryConnectionForDirtyInspection(version, inspection)
	connection.execResults = append(connection.execResults, reset)
	return connection
}

func recoveryConnectionForDirtyInspection(
	version int,
	inspection migrationSchemaInspection,
) *scriptedMigrationConnection {
	return &scriptedMigrationConnection{
		queryResults: inspectionQueryResults(inspection),
		rowResults: []scriptedMigrationRow{
			{values: []any{"wiredraft", "public"}},
			{values: []any{version, true, int64(1)}},
			{values: []any{true}},
		},
		execResults: []scriptedMigrationExec{{tag: "SELECT 1"}},
	}
}

func initialMigrationInspection() migrationSchemaInspection {
	return migrationSchemaInspection{
		tables: map[string]map[string]migrationColumn{
			"topologies": cloneMigrationColumns(initialTopologyColumns),
			"auth_state": cloneMigrationColumns(authStateColumns),
		},
		constraints: cloneMigrationConstraints(initialMigrationConstraints),
		indexes:     migrationIndexSet(initialMigrationIndexes),
	}
}

func organizationMigrationInspection(dataValid bool) migrationSchemaInspection {
	inspection := initialMigrationInspection()
	inspection.tables["topologies"]["organization_id"] = migrationColumn{dataType: "uuid"}
	inspection.tables["organizations"] = cloneMigrationColumns(organizationColumns)
	for name, constraintType := range organizationMigrationConstraints {
		inspection.constraints[name] = constraintType
	}
	for _, name := range organizationMigrationIndexes {
		inspection.indexes[name] = struct{}{}
	}
	inspection.organizationDataValid = dataValid
	return inspection
}

func partialOrganizationMigrationInspection() migrationSchemaInspection {
	inspection := initialMigrationInspection()
	inspection.tables["organizations"] = cloneMigrationColumns(organizationColumns)
	return inspection
}

func initialMigrationInspectionWithExtraColumn() migrationSchemaInspection {
	inspection := initialMigrationInspection()
	inspection.tables["topologies"]["unexpected"] = migrationColumn{dataType: "text"}
	return inspection
}

func cloneMigrationColumns(source map[string]migrationColumn) map[string]migrationColumn {
	clone := make(map[string]migrationColumn, len(source))
	for name, column := range source {
		clone[name] = column
	}
	return clone
}

func cloneMigrationConstraints(source map[string]string) map[string]string {
	clone := make(map[string]string, len(source))
	for name, constraintType := range source {
		clone[name] = constraintType
	}
	return clone
}

func migrationIndexSet(names []string) map[string]struct{} {
	indexes := make(map[string]struct{}, len(names))
	for _, name := range names {
		indexes[name] = struct{}{}
	}
	return indexes
}

type scriptedMigrationConnection struct {
	queryResults []scriptedMigrationRows
	rowResults   []scriptedMigrationRow
	execResults  []scriptedMigrationExec
	queries      []string
	executes     []string
}

func (c *scriptedMigrationConnection) Query(
	_ context.Context,
	query string,
	_ ...any,
) (pgx.Rows, error) {
	c.queries = append(c.queries, query)
	if len(c.queryResults) == 0 {
		return nil, errors.New("test: unexpected query")
	}
	result := c.queryResults[0]
	c.queryResults = c.queryResults[1:]
	if result.err != nil {
		return nil, result.err
	}
	return &result, nil
}

func (c *scriptedMigrationConnection) QueryRow(
	_ context.Context,
	_ string,
	_ ...any,
) pgx.Row {
	if len(c.rowResults) == 0 {
		return scriptedMigrationRow{err: errors.New("test: unexpected query row")}
	}
	result := c.rowResults[0]
	c.rowResults = c.rowResults[1:]
	return result
}

func (c *scriptedMigrationConnection) Exec(
	_ context.Context,
	query string,
	_ ...any,
) (pgconn.CommandTag, error) {
	c.executes = append(c.executes, query)
	if len(c.execResults) == 0 {
		return pgconn.CommandTag{}, errors.New("test: unexpected exec")
	}
	result := c.execResults[0]
	c.execResults = c.execResults[1:]
	return pgconn.NewCommandTag(result.tag), result.err
}

func (c *scriptedMigrationConnection) assertConsumed(t *testing.T) {
	t.Helper()
	if len(c.queryResults) != 0 || len(c.rowResults) != 0 || len(c.execResults) != 0 {
		t.Fatalf("unconsumed script: queries=%d rows=%d execs=%d",
			len(c.queryResults), len(c.rowResults), len(c.execResults))
	}
}

type scriptedMigrationRows struct {
	values  [][]any
	err     error
	rowsErr error
	scanErr error
	index   int
	closed  bool
}

func (r *scriptedMigrationRows) Close() { r.closed = true }

func (r *scriptedMigrationRows) Err() error { return r.rowsErr }

func (r *scriptedMigrationRows) CommandTag() pgconn.CommandTag { return pgconn.CommandTag{} }

func (r *scriptedMigrationRows) FieldDescriptions() []pgconn.FieldDescription { return nil }

func (r *scriptedMigrationRows) Next() bool {
	if r.index >= len(r.values) {
		r.closed = true
		return false
	}
	r.index++
	return true
}

func (r *scriptedMigrationRows) Scan(dest ...any) error {
	if r.scanErr != nil {
		return r.scanErr
	}
	if r.index == 0 || r.index > len(r.values) {
		return errors.New("test: scan without current row")
	}
	return assignMigrationValues(dest, r.values[r.index-1])
}

func (r *scriptedMigrationRows) Values() ([]any, error) {
	if r.index == 0 || r.index > len(r.values) {
		return nil, errors.New("test: values without current row")
	}
	return slices.Clone(r.values[r.index-1]), nil
}

func (r *scriptedMigrationRows) RawValues() [][]byte { return nil }

func (r *scriptedMigrationRows) Conn() *pgx.Conn { return nil }

type scriptedMigrationRow struct {
	values []any
	err    error
}

func (r scriptedMigrationRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	return assignMigrationValues(dest, r.values)
}

type scriptedMigrationExec struct {
	tag string
	err error
}

func assignMigrationValues(dest []any, values []any) error {
	if len(dest) != len(values) {
		return fmt.Errorf("test: scan destinations = %d, values = %d", len(dest), len(values))
	}
	for index, value := range values {
		switch destination := dest[index].(type) {
		case *string:
			*destination = value.(string)
		case *bool:
			*destination = value.(bool)
		case *int:
			*destination = value.(int)
		case *int64:
			*destination = value.(int64)
		default:
			return fmt.Errorf("test: unsupported scan destination %T", destination)
		}
	}
	return nil
}

func inspectionQueryResults(inspection migrationSchemaInspection) []scriptedMigrationRows {
	columnValues := make([][]any, 0)
	tableNames := make([]string, 0, len(inspection.tables))
	for tableName := range inspection.tables {
		tableNames = append(tableNames, tableName)
	}
	slices.Sort(tableNames)
	for _, tableName := range tableNames {
		columnNames := make([]string, 0, len(inspection.tables[tableName]))
		for columnName := range inspection.tables[tableName] {
			columnNames = append(columnNames, columnName)
		}
		slices.Sort(columnNames)
		for _, columnName := range columnNames {
			column := inspection.tables[tableName][columnName]
			columnValues = append(columnValues, []any{
				tableName, columnName, column.dataType, column.nullable, column.generated,
			})
		}
	}
	constraintValues := make([][]any, 0, len(inspection.constraints))
	constraintNames := make([]string, 0, len(inspection.constraints))
	for name := range inspection.constraints {
		constraintNames = append(constraintNames, name)
	}
	slices.Sort(constraintNames)
	for _, name := range constraintNames {
		tableName, constraintName, found := strings.Cut(name, ".")
		if !found {
			panic("test: invalid constraint fixture " + name)
		}
		constraintValues = append(constraintValues, []any{tableName, constraintName, inspection.constraints[name]})
	}
	indexValues := make([][]any, 0, len(inspection.indexes))
	indexNames := make([]string, 0, len(inspection.indexes))
	for name := range inspection.indexes {
		indexNames = append(indexNames, name)
	}
	slices.Sort(indexNames)
	for _, name := range indexNames {
		tableName, indexName, found := strings.Cut(name, ".")
		if !found {
			panic("test: invalid index fixture " + name)
		}
		indexValues = append(indexValues, []any{tableName, indexName})
	}
	return []scriptedMigrationRows{
		{values: columnValues},
		{values: constraintValues},
		{values: indexValues},
	}
}

func TestCloseMigrationDatabaseHandle(t *testing.T) {
	t.Parallel()
	handle, err := sql.Open("pgx", "postgres://wiredraft@localhost/wiredraft")
	if err != nil {
		t.Fatal(err)
	}
	if err := closeMigrationDatabaseHandle(handle); err != nil {
		t.Fatal(err)
	}
}

func TestLegacyTopologyFixturesLoadAndNormalize(t *testing.T) {
	t.Parallel()
	fixtures, err := fs.Glob(migrationFixtures, "testdata/migrations/*.json")
	if err != nil {
		t.Fatal(err)
	}
	if len(fixtures) == 0 {
		t.Fatal("migration fixture suite is empty")
	}
	for _, fixture := range fixtures {
		fixture := fixture
		t.Run(filepath.Base(fixture), func(t *testing.T) {
			t.Parallel()
			data, err := migrationFixtures.ReadFile(fixture)
			if err != nil {
				t.Fatal(err)
			}
			directory := t.TempDir()
			root, err := os.OpenRoot(directory)
			if err != nil {
				t.Fatal(err)
			}
			if err := root.WriteFile(filepath.Base(fixture), data, 0o600); err != nil {
				_ = root.Close()
				t.Fatal(err)
			}
			if err := root.Close(); err != nil {
				t.Fatal(err)
			}
			jsonStore, err := NewJSONStore(directory)
			if err != nil {
				t.Fatalf("legacy fixture no longer loads: %v", err)
			}
			summaries, err := jsonStore.List(t.Context())
			if err != nil {
				t.Fatal(err)
			}
			if len(summaries) != 1 {
				t.Fatalf("loaded summaries = %d, want 1", len(summaries))
			}
			topology, err := jsonStore.Get(t.Context(), summaries[0].ID)
			if err != nil {
				t.Fatal(err)
			}
			if topology.Racks == nil || topology.Devices == nil || topology.Links == nil || topology.LinkGroups == nil ||
				topology.SwitchSystems == nil || topology.FirewallClusters == nil || topology.VLANs == nil {
				t.Fatal("legacy optional collections were not normalized")
			}
			if topology.OrganizationID != "00000000-0000-4000-8000-000000000000" || topology.Organization != "Default" {
				t.Fatalf("legacy organization = %q / %q, want Default", topology.OrganizationID, topology.Organization)
			}
		})
	}
}
