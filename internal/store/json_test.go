package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"netdiagram/internal/model"
)

func TestJSONStoreRecovery(t *testing.T) {
	directory := t.TempDir()
	first, err := NewJSONStore(directory)
	if err != nil {
		t.Fatalf("NewJSONStore() error = %v", err)
	}
	summaries, err := first.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(summaries) != 1 {
		t.Fatalf("List() count = %d, want 1", len(summaries))
	}
	if _, err := first.Mutate(t.Context(), summaries[0].ID, func(topology *model.Topology) error {
		topology.Name = "Recovered topology"
		return nil
	}); err != nil {
		t.Fatalf("Mutate() error = %v", err)
	}

	second, err := NewJSONStore(directory)
	if err != nil {
		t.Fatalf("reopen NewJSONStore() error = %v", err)
	}
	recovered, err := second.Get(t.Context(), summaries[0].ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if recovered.Name != "Recovered topology" {
		t.Fatalf("Name = %q, want Recovered topology", recovered.Name)
	}
}

func TestJSONStoreDelete(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	jsonStore, err := NewJSONStore(directory)
	if err != nil {
		t.Fatal(err)
	}
	summaries, err := jsonStore.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	id := summaries[0].ID
	if err := jsonStore.Delete(t.Context(), id); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if _, err := jsonStore.Get(t.Context(), id); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get() after delete error = %v, want ErrNotFound", err)
	}
	if _, err := os.Stat(filepath.Join(directory, id+".json")); !os.IsNotExist(err) {
		t.Fatalf("deleted topology file still exists: %v", err)
	}
	if err := jsonStore.Delete(t.Context(), id); !errors.Is(err, ErrNotFound) {
		t.Fatalf("second Delete() error = %v, want ErrNotFound", err)
	}
}

func TestJSONStoreConcurrentMutations(t *testing.T) {
	jsonStore, err := NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	summaries, err := jsonStore.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	id := summaries[0].ID
	var wait sync.WaitGroup
	for index := range 12 {
		index := index
		wait.Go(func() {
			_, mutationErr := jsonStore.Mutate(t.Context(), id, func(topology *model.Topology) error {
				topology.VLANs = append(topology.VLANs, model.VLAN{
					ID:          100 + index,
					Name:        fmt.Sprintf("Concurrent %d", index),
					ColorHex:    fmt.Sprintf("#%06x", 0x334455+index),
					Description: "Concurrent test",
				})
				return nil
			})
			if mutationErr != nil {
				t.Errorf("Mutate() error = %v", mutationErr)
			}
		})
	}
	wait.Wait()
	topology, err := jsonStore.Get(t.Context(), id)
	if err != nil {
		t.Fatal(err)
	}
	if len(topology.VLANs) != 16 {
		t.Fatalf("VLAN count = %d, want 16", len(topology.VLANs))
	}
}

func TestJSONStoreAtomicFileAlwaysDecodes(t *testing.T) {
	directory := t.TempDir()
	jsonStore, err := NewJSONStore(directory)
	if err != nil {
		t.Fatal(err)
	}
	summaries, err := jsonStore.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	id := summaries[0].ID
	root, err := os.OpenRoot(directory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := root.Close(); closeErr != nil {
			t.Errorf("Close() error = %v", closeErr)
		}
	})
	for index := range 20 {
		if _, err := jsonStore.Mutate(t.Context(), id, func(topology *model.Topology) error {
			topology.Name = fmt.Sprintf("Atomic %d", index)
			return nil
		}); err != nil {
			t.Fatal(err)
		}
		data, err := root.ReadFile(id + ".json")
		if err != nil {
			t.Fatal(err)
		}
		var topology model.Topology
		if err := json.Unmarshal(data, &topology); err != nil {
			t.Fatalf("persisted file is invalid: %v", err)
		}
	}
}
