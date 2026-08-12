package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"wiredraft/internal/model"
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

func TestJSONStoreSaveToDisk(t *testing.T) {
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
	topologyPath := filepath.Join(directory, summaries[0].ID+".json")
	if err := os.Remove(topologyPath); err != nil {
		t.Fatal(err)
	}
	if err := jsonStore.SaveToDisk(summaries[0].ID); err != nil {
		t.Fatal(err)
	}
	if _, err := NewJSONStore(directory); err != nil {
		t.Fatalf("saved snapshot did not reopen: %v", err)
	}
	if err := jsonStore.SaveToDisk("missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("SaveToDisk(missing) error = %v, want ErrNotFound", err)
	}
}

func TestJSONStoreOrganizationLifecycle(t *testing.T) {
	t.Parallel()
	jsonStore, err := NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	organizations, err := jsonStore.ListOrganizations(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(organizations) != 1 || organizations[0].ID != model.DefaultOrganizationID || !organizations[0].IsDefault {
		t.Fatalf("organizations = %#v, want protected Default", organizations)
	}
	if _, err := jsonStore.RenameOrganization(t.Context(), model.DefaultOrganizationID, "Renamed"); !errors.Is(err, ErrProtectedOrganization) {
		t.Fatalf("RenameOrganization(Default) error = %v, want ErrProtectedOrganization", err)
	}
	if err := jsonStore.DeleteOrganization(t.Context(), model.DefaultOrganizationID); !errors.Is(err, ErrProtectedOrganization) {
		t.Fatalf("DeleteOrganization(Default) error = %v, want ErrProtectedOrganization", err)
	}

	organization, err := jsonStore.CreateOrganization(t.Context(), "Vienna")
	if err != nil {
		t.Fatal(err)
	}
	resolved, err := jsonStore.GetOrganization(t.Context(), organization.ID)
	if err != nil || resolved.ID != organization.ID || resolved.Name != organization.Name {
		t.Fatalf("GetOrganization() = %#v, error = %v", resolved, err)
	}
	if _, err := jsonStore.GetOrganization(t.Context(), "invalid"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("GetOrganization(invalid) error = %v, want ErrInvalid", err)
	}
	if _, err := jsonStore.GetOrganization(t.Context(), "11111111-1111-4111-8111-111111111111"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("GetOrganization(missing) error = %v, want ErrNotFound", err)
	}
	if _, err := jsonStore.CreateOrganization(t.Context(), " vienna "); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate CreateOrganization() error = %v, want ErrConflict", err)
	}
	demo, err := model.NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	demo.ID, err = model.NewID()
	if err != nil {
		t.Fatal(err)
	}
	demo.OrganizationID = organization.ID
	demo.Organization = "caller-supplied stale name"
	created, err := jsonStore.Create(t.Context(), demo)
	if err != nil {
		t.Fatal(err)
	}
	if created.Organization != "Vienna" {
		t.Fatalf("Create() organization = %q, want registry name", created.Organization)
	}
	if err := jsonStore.DeleteOrganization(t.Context(), organization.ID); !errors.Is(err, ErrOrganizationInUse) {
		t.Fatalf("DeleteOrganization(in use) error = %v, want ErrOrganizationInUse", err)
	}
	renamed, err := jsonStore.RenameOrganization(t.Context(), organization.ID, "Vienna HQ")
	if err != nil {
		t.Fatal(err)
	}
	if renamed.ID != organization.ID {
		t.Fatalf("renamed id = %q, want stable %q", renamed.ID, organization.ID)
	}
	loaded, err := jsonStore.Get(t.Context(), created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.OrganizationID != organization.ID || loaded.Organization != "Vienna HQ" {
		t.Fatalf("Get() organization = %q / %q, want %q / Vienna HQ", loaded.OrganizationID, loaded.Organization, organization.ID)
	}
	if err := jsonStore.Delete(t.Context(), created.ID); err != nil {
		t.Fatal(err)
	}
	if err := jsonStore.DeleteOrganization(t.Context(), organization.ID); err != nil {
		t.Fatal(err)
	}
}

func TestJSONStoreRejectsInvalidOrganizationRegistry(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 8, 12, 12, 0, 0, 0, time.UTC)
	defaultOrganization := Organization{
		ID: model.DefaultOrganizationID, Name: model.DefaultOrganizationName,
		IsDefault: true, CreatedAt: now, UpdatedAt: now,
	}
	validRegistry, err := json.Marshal([]Organization{defaultOrganization})
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name          string
		organizations []Organization
		raw           []byte
		want          string
	}{
		{name: "invalid JSON", raw: []byte("{"), want: "decoding organization registry"},
		{name: "trailing JSON", raw: append(append([]byte(nil), validRegistry...), []byte("\n{}")...), want: "checking organization registry"},
		{name: "missing Default", organizations: []Organization{}, want: "protected Default organization is missing"},
		{
			name: "missing timestamps", organizations: []Organization{{
				ID: model.DefaultOrganizationID, Name: model.DefaultOrganizationName, IsDefault: true,
			}},
			want: "timestamps must be set",
		},
		{
			name: "duplicate name", organizations: []Organization{
				defaultOrganization,
				{ID: "11111111-1111-4111-8111-111111111111", Name: "Vienna", CreatedAt: now, UpdatedAt: now},
				{ID: "22222222-2222-4222-8222-222222222222", Name: "vienna", CreatedAt: now, UpdatedAt: now},
			},
			want: "duplicate name",
		},
		{
			name: "duplicate id", organizations: []Organization{defaultOrganization, defaultOrganization},
			want: "duplicate id",
		},
		{
			name: "multiple defaults", organizations: []Organization{
				defaultOrganization,
				{
					ID: "11111111-1111-4111-8111-111111111111", Name: "Vienna", IsDefault: true,
					CreatedAt: now, UpdatedAt: now,
				},
			},
			want: "multiple default organizations",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			directory := t.TempDir()
			data := test.raw
			if data == nil {
				var err error
				data, err = json.Marshal(test.organizations)
				if err != nil {
					t.Fatal(err)
				}
			}
			if err := os.WriteFile(filepath.Join(directory, organizationRegistryFile), data, 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := NewJSONStore(directory); err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("NewJSONStore() error = %v, want message containing %q", err, test.want)
			}
		})
	}
}

func TestJSONStoreMigratesLegacyOrganizations(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	legacy, err := model.NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	legacy.OrganizationID = ""
	legacy.Organization = "Legacy Corp"
	type topologyDocument model.Topology
	data, err := json.Marshal(topologyDocument(legacy))
	if err != nil {
		t.Fatal(err)
	}
	// Marshal through an alias without Topology's validating MarshalJSON.
	var document map[string]any
	if err := json.Unmarshal(data, &document); err != nil {
		t.Fatal(err)
	}
	delete(document, "organizationId")
	data, err = json.MarshalIndent(document, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, legacy.ID+".json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	jsonStore, err := NewJSONStore(directory)
	if err != nil {
		t.Fatal(err)
	}
	organization, err := jsonStore.FindOrganizationByName(t.Context(), "legacy corp")
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := jsonStore.Get(t.Context(), legacy.ID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.OrganizationID != organization.ID || loaded.Organization != organization.Name {
		t.Fatalf("migrated ownership = %q / %q, want %q / %q", loaded.OrganizationID, loaded.Organization, organization.ID, organization.Name)
	}
}

func TestJSONStorePreservesLegacyStableOrganizationID(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	legacy, err := model.NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	const organizationID = "11111111-1111-4111-8111-111111111111"
	legacy.OrganizationID = organizationID
	legacy.Organization = "Vienna"
	type topologyDocument model.Topology
	data, err := json.Marshal(topologyDocument(legacy))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, legacy.ID+".json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	jsonStore, err := NewJSONStore(directory)
	if err != nil {
		t.Fatal(err)
	}
	organization, err := jsonStore.GetOrganization(t.Context(), organizationID)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := jsonStore.Get(t.Context(), legacy.ID)
	if err != nil {
		t.Fatal(err)
	}
	if organization.Name != "Vienna" || loaded.OrganizationID != organizationID || loaded.Organization != "Vienna" {
		t.Fatalf("preserved organization = %#v, topology = %q / %q", organization, loaded.OrganizationID, loaded.Organization)
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

func TestJSONStoreDeleteAtRevisionAuthorizesLockedSnapshot(t *testing.T) {
	t.Parallel()
	jsonStore, err := NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	summaries, err := jsonStore.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	id := summaries[0].ID
	current, err := jsonStore.Get(t.Context(), id)
	if err != nil {
		t.Fatal(err)
	}
	denied := errors.New("test: access denied")
	if err := jsonStore.DeleteAtRevision(t.Context(), id, current.Revision, func(snapshot model.Topology) error {
		if snapshot.ID != id || snapshot.Revision != current.Revision {
			t.Fatalf("authorized snapshot = %q rev %d", snapshot.ID, snapshot.Revision)
		}
		return denied
	}); !errors.Is(err, denied) {
		t.Fatalf("DeleteAtRevision() authorization error = %v, want denied", err)
	}
	if _, err := jsonStore.Get(t.Context(), id); err != nil {
		t.Fatalf("denied deletion removed topology: %v", err)
	}

	updated, err := jsonStore.Mutate(t.Context(), id, func(topology *model.Topology) error {
		topology.Name = "newer snapshot"
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := jsonStore.DeleteAtRevision(t.Context(), id, current.Revision, nil); err == nil {
		t.Fatal("DeleteAtRevision() accepted stale revision")
	} else {
		var conflict *RevisionConflictError
		if !errors.As(err, &conflict) || conflict.Expected != current.Revision || conflict.Actual != updated.Revision {
			t.Fatalf("stale deletion error = %#v", err)
		}
	}
	if _, err := jsonStore.Get(t.Context(), id); err != nil {
		t.Fatalf("stale deletion removed topology: %v", err)
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
