package store

import (
	"encoding/json"
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
	summaries := first.List()
	if len(summaries) != 1 {
		t.Fatalf("List() count = %d, want 1", len(summaries))
	}
	if _, err := first.Mutate(summaries[0].ID, func(topology *model.Topology) error {
		topology.Name = "Recovered topology"
		return nil
	}); err != nil {
		t.Fatalf("Mutate() error = %v", err)
	}

	second, err := NewJSONStore(directory)
	if err != nil {
		t.Fatalf("reopen NewJSONStore() error = %v", err)
	}
	recovered, err := second.Get(summaries[0].ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if recovered.Name != "Recovered topology" {
		t.Fatalf("Name = %q, want Recovered topology", recovered.Name)
	}
}

func TestJSONStoreConcurrentMutations(t *testing.T) {
	jsonStore, err := NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	id := jsonStore.List()[0].ID
	var wait sync.WaitGroup
	for index := range 12 {
		index := index
		wait.Go(func() {
			_, mutationErr := jsonStore.Mutate(id, func(topology *model.Topology) error {
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
	topology, err := jsonStore.Get(id)
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
	id := jsonStore.List()[0].ID
	path := filepath.Join(directory, id+".json")
	for index := range 20 {
		if _, err := jsonStore.Mutate(id, func(topology *model.Topology) error {
			topology.Name = fmt.Sprintf("Atomic %d", index)
			return nil
		}); err != nil {
			t.Fatal(err)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var topology model.Topology
		if err := json.Unmarshal(data, &topology); err != nil {
			t.Fatalf("persisted file is invalid: %v", err)
		}
	}
}
