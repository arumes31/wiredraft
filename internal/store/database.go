package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const connectTimeout = 10 * time.Second

// OpenDatabase creates and verifies a bounded PostgreSQL connection pool. An
// empty URL lets pgx read PGHOST, PGPORT, PGDATABASE, PGUSER, and PGPASSWORD.
func OpenDatabase(ctx context.Context, url string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parsing database configuration: %w", err)
	}
	config.MaxConns = 20
	config.MinIdleConns = 1
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = time.Minute

	connectCtx, cancel := context.WithTimeout(ctx, connectTimeout)
	defer cancel()
	pool, err := pgxpool.NewWithConfig(connectCtx, config)
	if err != nil {
		return nil, fmt.Errorf("opening database pool: %w", err)
	}
	if err := pool.Ping(connectCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}
	return pool, nil
}

// instanceLockKey is the session-level advisory lock that marks the single
// WireDraft process allowed to use a database.
const instanceLockKey int64 = 0x5749524544524654 // "WIREDRFT"

// ErrInstanceRunning reports that another WireDraft process holds the lock.
var ErrInstanceRunning = errors.New("another WireDraft instance is already using this database")

// AcquireInstanceLock takes a dedicated connection out of the pool and holds a
// session advisory lock on it for the life of the process. Sessions and the
// authentication state are process-local and written whole, so a second
// replica would silently lose updates; this makes it fail at startup instead.
// The lock is released by the returned function or when the process exits.
func AcquireInstanceLock(ctx context.Context, pool *pgxpool.Pool) (func(), error) {
	pooled, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("acquiring instance lock connection: %w", err)
	}
	conn := pooled.Hijack()
	var acquired bool
	if err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock($1)`, instanceLockKey).Scan(&acquired); err != nil {
		_ = conn.Close(context.Background())
		return nil, fmt.Errorf("taking instance lock: %w", err)
	}
	if !acquired {
		_ = conn.Close(context.Background())
		return nil, ErrInstanceRunning
	}
	return func() { _ = conn.Close(context.Background()) }, nil
}
