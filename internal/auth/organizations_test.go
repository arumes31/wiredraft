package auth

import (
	"errors"
	"slices"
	"testing"
)

func TestMigrateOrganizationAssignments(t *testing.T) {
	t.Parallel()
	catalog, err := newOrganizationCatalog(testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	state := persistentState{Version: 2, Users: []persistedUser{
		{
			ID: "scoped", Role: RoleUser,
			LegacyOrganizations: []string{" vienna ", "BERLIN", "Vienna"},
		},
		{
			ID: "administrator", Role: RoleAdmin,
			LegacyOrganizations: []string{"London"},
		},
	}}
	migrated, err := migrateOrganizationAssignments(&state, catalog)
	if err != nil {
		t.Fatal(err)
	}
	if !migrated || state.Version != authStateVersion {
		t.Fatalf("migrated = %v, version = %d", migrated, state.Version)
	}
	if !slices.Equal(state.Users[0].OrganizationIDs, []string{
		testBerlinOrganizationID,
		testViennaOrganizationID,
	}) || len(state.Users[0].LegacyOrganizations) != 0 {
		t.Fatalf("scoped user = %#v", state.Users[0])
	}
	if !state.Users[1].AllOrganizations || len(state.Users[1].OrganizationIDs) != 0 ||
		len(state.Users[1].LegacyOrganizations) != 0 {
		t.Fatalf("administrator = %#v", state.Users[1])
	}
}

func TestMigrateOrganizationAssignmentsRejectsMissingLegacyName(t *testing.T) {
	t.Parallel()
	catalog, err := newOrganizationCatalog(testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	state := persistentState{Version: 2, Users: []persistedUser{{
		ID: "scoped", Role: RoleUser, LegacyOrganizations: []string{"Removed Organization"},
	}}}
	if _, err := migrateOrganizationAssignments(&state, catalog); err == nil {
		t.Fatal("migration accepted an unregistered legacy organization")
	}
}

func TestMigrateOrganizationAssignmentsRemovesOrphanedCurrentGrant(t *testing.T) {
	t.Parallel()
	catalog, err := newOrganizationCatalog(testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	state := persistentState{Version: authStateVersion, Users: []persistedUser{{
		ID: "scoped", Role: RoleUser,
		OrganizationIDs: []string{testViennaOrganizationID, "deleted-organization"},
	}}}
	migrated, err := migrateOrganizationAssignments(&state, catalog)
	if err != nil {
		t.Fatal(err)
	}
	if !migrated || !slices.Equal(state.Users[0].OrganizationIDs, []string{testViennaOrganizationID}) {
		t.Fatalf("state = %#v, migrated = %v", state, migrated)
	}

	state.Users[0].OrganizationIDs = []string{"deleted-organization"}
	if _, err := migrateOrganizationAssignments(&state, catalog); err != nil {
		t.Fatal(err)
	}
	if len(state.Users[0].OrganizationIDs) != 0 {
		t.Fatalf("orphan cleanup widened access: %#v", state.Users[0].OrganizationIDs)
	}
}

func TestOrganizationCatalogValidationAndRegistration(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		refs []OrganizationRef
	}{
		{name: "empty id", refs: []OrganizationRef{{Name: "Default"}}},
		{name: "empty name", refs: []OrganizationRef{{ID: "default"}}},
		{name: "duplicate id", refs: []OrganizationRef{{ID: "same", Name: "One"}, {ID: "same", Name: "Two"}}},
		{name: "duplicate normalized name", refs: []OrganizationRef{{ID: "one", Name: "Vienna"}, {ID: "two", Name: " vienna "}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if _, err := newOrganizationCatalog(test.refs); err == nil {
				t.Fatal("invalid catalog was accepted")
			}
		})
	}

	catalog, err := newOrganizationCatalog([]OrganizationRef{{ID: "one", Name: "One"}})
	if err != nil {
		t.Fatal(err)
	}
	if err := catalog.register(OrganizationRef{ID: "one", Name: "Renamed"}); err != nil {
		t.Fatal(err)
	}
	if id, exists := catalog.idByName("renamed"); !exists || id != "one" {
		t.Fatalf("renamed organization = %q, exists = %v", id, exists)
	}
	if _, exists := catalog.idByName("One"); exists {
		t.Fatal("old catalog name remains registered")
	}
	if err := catalog.register(OrganizationRef{ID: "two", Name: "RENAMED"}); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate name error = %v, want ErrConflict", err)
	}
}

func TestGuestOrganizationBindingSurvivesRename(t *testing.T) {
	t.Parallel()
	catalog, err := newOrganizationCatalog(testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	state := persistentState{Version: authStateVersion}
	migrated, err := migrateGuestOrganization(&state, catalog, false)
	if err != nil || !migrated || state.GuestOrganizationID != testGuestOrganizationID {
		t.Fatalf("disabled Guest binding = %#v, migrated = %v, error = %v", state, migrated, err)
	}
	renamed := slices.Clone(testOrganizationRefs)
	for index := range renamed {
		if renamed[index].ID == testGuestOrganizationID {
			renamed[index].Name = "Visitor Workspace"
		}
	}
	renamedCatalog, err := newOrganizationCatalog(renamed)
	if err != nil {
		t.Fatal(err)
	}
	migrated, err = migrateGuestOrganization(&state, renamedCatalog, false)
	if err != nil || migrated || state.GuestOrganizationID != testGuestOrganizationID {
		t.Fatalf("renamed state = %#v, migrated = %v, error = %v", state, migrated, err)
	}
}

func TestLegacyOrganizationNamesDeduplicatesCaseInsensitively(t *testing.T) {
	t.Parallel()
	state := persistentState{Users: []persistedUser{
		{LegacyOrganizations: []string{" Vienna ", "BERLIN"}},
		{LegacyOrganizations: []string{"vienna", ""}},
	}}
	if got := legacyOrganizationNames(state); !slices.Equal(got, []string{"BERLIN", "Vienna"}) {
		t.Fatalf("legacy names = %#v", got)
	}
}
