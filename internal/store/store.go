// Package store persists topology aggregates as atomic JSON files.
package store

import (
	"errors"

	"netdiagram/internal/model"
)

var (
	// ErrNotFound indicates that a requested topology or child resource does not exist.
	ErrNotFound = errors.New("store: not found")
	// ErrConflict indicates that a proposed resource conflicts with existing state.
	ErrConflict = errors.New("store: conflict")
	// ErrInvalid indicates that a proposed topology violates a domain invariant.
	ErrInvalid = errors.New("store: invalid topology")
)

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
	List() []model.Summary
	Get(id string) (model.Topology, error)
	Create(topology model.Topology) (model.Topology, error)
	Mutate(id string, mutation func(*model.Topology) error) (model.Topology, error)
	MutateAtRevision(id string, expectedRevision uint64, mutation func(*model.Topology) error) (model.Topology, error)
	SaveToDisk(id string) error
}
