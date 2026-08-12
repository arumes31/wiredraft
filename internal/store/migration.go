package store

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
	migratepgx "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
)

const migrationDirectory = "migrations"

//go:embed migrations/*.sql
var migrationFiles embed.FS

// MigrateDatabase applies every pending embedded schema migration. It is safe
// to call on each startup; concurrent callers coordinate through PostgreSQL's
// advisory-lock implementation in the migration driver.
func MigrateDatabase(pool *pgxpool.Pool) (returnErr error) {
	migrator, err := newMigrator(pool)
	if err != nil {
		return err
	}
	defer func() {
		sourceErr, databaseErr := migrator.Close()
		if sourceErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("closing migration source: %w", sourceErr))
		}
		if databaseErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("closing migration database: %w", databaseErr))
		}
	}()

	if err := migrator.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("applying database migrations: %w", err)
	}
	return nil
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
