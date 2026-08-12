package main

import (
	"context"
	"errors"
	"slices"
	"testing"

	"wiredraft/internal/auth"
	"wiredraft/internal/store"
)

type startupOrganizationGetter struct {
	organizations map[string]store.Organization
	err           error
}

func (g startupOrganizationGetter) GetOrganization(_ context.Context, id string) (store.Organization, error) {
	if g.err != nil {
		return store.Organization{}, g.err
	}
	organization, exists := g.organizations[id]
	if !exists {
		return store.Organization{}, store.ErrNotFound
	}
	return organization, nil
}

func TestStartupOrganizationNamesPreservesStableGuestBinding(t *testing.T) {
	t.Parallel()
	const guestOrganizationID = "renamed-guest-id"
	getter := startupOrganizationGetter{organizations: map[string]store.Organization{
		guestOrganizationID: {ID: guestOrganizationID, Name: "Visitor Workspace"},
	}}
	preflight := auth.Preflight{
		LegacyOrganizationNames: []string{"Vienna"},
		GuestOrganizationID:     guestOrganizationID,
		LegacyGuestTopologyIDs:  []string{"overbroad-v2-snapshot"},
	}

	for _, guestEnabled := range []bool{false, true} {
		names, err := startupOrganizationNames(t.Context(), getter, preflight, guestEnabled)
		if err != nil {
			t.Fatal(err)
		}
		if !slices.Equal(names, []string{"Vienna"}) {
			t.Fatalf("guest enabled %v: names = %#v, want no duplicate Guest", guestEnabled, names)
		}
	}
	if !slices.Equal(preflight.LegacyOrganizationNames, []string{"Vienna"}) {
		t.Fatalf("preflight names were mutated: %#v", preflight.LegacyOrganizationNames)
	}
}

func TestStartupOrganizationNamesCreatesGuestOnlyWhenRequired(t *testing.T) {
	t.Parallel()
	missing := startupOrganizationGetter{organizations: map[string]store.Organization{}}
	tests := []struct {
		name         string
		preflight    auth.Preflight
		guestEnabled bool
		want         []string
	}{
		{name: "missing state disabled", want: []string{}},
		{name: "missing state enabled", guestEnabled: true, want: []string{auth.GuestOrganizationName}},
		{
			name:      "legacy workspace disabled",
			preflight: auth.Preflight{LegacyGuestTopologyIDs: []string{"legacy-map"}},
			want:      []string{auth.GuestOrganizationName},
		},
		{
			name:         "orphaned binding enabled",
			preflight:    auth.Preflight{GuestOrganizationID: "removed-guest-id"},
			guestEnabled: true,
			want:         []string{auth.GuestOrganizationName},
		},
		{
			name:      "orphaned binding disabled",
			preflight: auth.Preflight{GuestOrganizationID: "removed-guest-id"},
			want:      []string{},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got, err := startupOrganizationNames(t.Context(), missing, test.preflight, test.guestEnabled)
			if err != nil {
				t.Fatal(err)
			}
			if !slices.Equal(got, test.want) {
				t.Fatalf("names = %#v, want %#v", got, test.want)
			}
		})
	}
}

func TestStartupOrganizationNamesReturnsLookupFailure(t *testing.T) {
	t.Parallel()
	lookupErr := errors.New("lookup failed")
	_, err := startupOrganizationNames(t.Context(), startupOrganizationGetter{err: lookupErr}, auth.Preflight{
		GuestOrganizationID: "bound-guest-id",
	}, true)
	if !errors.Is(err, lookupErr) {
		t.Fatalf("error = %v, want lookup failure", err)
	}
}
