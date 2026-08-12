// Package store persists topology aggregates as atomic JSON files.
package store

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"wiredraft/internal/model"
)

var (
	// ErrNotFound indicates that a requested topology or child resource does not exist.
	ErrNotFound = errors.New("store: not found")
	// ErrConflict indicates that a proposed resource conflicts with existing state.
	ErrConflict = errors.New("store: conflict")
	// ErrInvalid indicates that a proposed resource violates a domain invariant.
	ErrInvalid = errors.New("store: invalid topology")
	// ErrProtectedOrganization indicates an attempt to rename or delete Default.
	ErrProtectedOrganization = errors.New("store: protected organization")
	// ErrOrganizationInUse indicates that maps still reference an organization.
	ErrOrganizationInUse = errors.New("store: organization in use")
)

var organizationIDPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

// Organization is a registered topology owner. IDs remain stable across rename.
type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	IsDefault bool      `json:"isDefault"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func normalizeOrganizationName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 120 {
		return "", fmt.Errorf("%w: organization name must contain 1 to 120 characters", ErrInvalid)
	}
	return name, nil
}

func validateOrganizationID(id string) (string, error) {
	id = strings.TrimSpace(id)
	if !organizationIDPattern.MatchString(id) {
		return "", fmt.Errorf("%w: organization id must be a version 4 uuid", ErrInvalid)
	}
	return id, nil
}

// RevisionConflictError reports an optimistic concurrency precondition failure.
type RevisionConflictError struct {
	Expected uint64
	Actual   uint64
}

func (e *RevisionConflictError) Error() string {
	return "store: topology revision conflict"
}

func (e *RevisionConflictError) Unwrap() error {
	return ErrConflict
}

// Store defines durable operations on complete topology aggregates.
type Store interface {
	EnsureOrganizations(ctx context.Context, legacyOrganizationNames []string) error
	ListOrganizations(ctx context.Context) ([]Organization, error)
	GetOrganization(ctx context.Context, id string) (Organization, error)
	FindOrganizationByName(ctx context.Context, name string) (Organization, error)
	CreateOrganization(ctx context.Context, name string) (Organization, error)
	RenameOrganization(ctx context.Context, id string, name string) (Organization, error)
	DeleteOrganization(ctx context.Context, id string) error
	List(ctx context.Context) ([]model.Summary, error)
	Get(ctx context.Context, id string) (model.Topology, error)
	Create(ctx context.Context, topology model.Topology) (model.Topology, error)
	Delete(ctx context.Context, id string) error
	DeleteAtRevision(ctx context.Context, id string, expectedRevision uint64, authorize func(model.Topology) error) error
	Mutate(ctx context.Context, id string, mutation func(*model.Topology) error) (model.Topology, error)
	MutateAtRevision(ctx context.Context, id string, expectedRevision uint64, mutation func(*model.Topology) error) (model.Topology, error)
}
