package store

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

//go:embed testdata/migrations/*.json
var migrationFixtures embed.FS

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
		})
	}
}
