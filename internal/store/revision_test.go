package store

import (
	"errors"
	"testing"

	"netdiagram/internal/model"
)

func TestMutateAtRevisionRejectsStaleMutation(t *testing.T) {
	t.Parallel()
	jsonStore, err := NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	summaries, err := jsonStore.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	summary := summaries[0]
	before, err := jsonStore.Get(t.Context(), summary.ID)
	if err != nil {
		t.Fatal(err)
	}
	updated, err := jsonStore.MutateAtRevision(t.Context(), before.ID, before.Revision, func(topology *model.Topology) error {
		topology.Name = "first writer"
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Revision != before.Revision+1 {
		t.Fatalf("revision = %d, want %d", updated.Revision, before.Revision+1)
	}
	_, err = jsonStore.MutateAtRevision(t.Context(), before.ID, before.Revision, func(topology *model.Topology) error {
		topology.Name = "stale writer"
		return nil
	})
	var conflict *RevisionConflictError
	if !errors.As(err, &conflict) || conflict.Expected != before.Revision || conflict.Actual != updated.Revision {
		t.Fatalf("error = %#v, want revision conflict %d -> %d", err, before.Revision, updated.Revision)
	}
	persisted, err := jsonStore.Get(t.Context(), before.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.Name != "first writer" {
		t.Fatalf("name = %q, stale mutation was not atomic", persisted.Name)
	}
}
