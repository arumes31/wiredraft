package store

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLegacyTopologyFixturesLoadAndNormalize(t *testing.T) {
	t.Parallel()
	fixtures, err := filepath.Glob(filepath.Join("testdata", "migrations", "*.json"))
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
			data, err := os.ReadFile(fixture)
			if err != nil {
				t.Fatal(err)
			}
			directory := t.TempDir()
			if err := os.WriteFile(filepath.Join(directory, filepath.Base(fixture)), data, 0o600); err != nil {
				t.Fatal(err)
			}
			jsonStore, err := NewJSONStore(directory)
			if err != nil {
				t.Fatalf("legacy fixture no longer loads: %v", err)
			}
			if len(jsonStore.List()) != 1 {
				t.Fatalf("loaded summaries = %d, want 1", len(jsonStore.List()))
			}
			topology, err := jsonStore.Get(jsonStore.List()[0].ID)
			if err != nil {
				t.Fatal(err)
			}
			if topology.Racks == nil || topology.Devices == nil || topology.Links == nil || topology.LinkGroups == nil ||
				topology.SwitchSystems == nil || topology.FirewallClusters == nil || topology.VLANs == nil {
				t.Fatal("legacy optional collections were not normalized")
			}
		})
	}
}
