package auth

import (
	"errors"
	"fmt"
	"slices"
	"strings"
)

// GuestOrganizationName is the reserved display name used to resolve the
// Guest workspace's stable organization ID at startup.
const GuestOrganizationName = "Guest"

type organizationCatalog struct {
	byID   map[string]OrganizationRef
	byName map[string]string
}

func newOrganizationCatalog(refs []OrganizationRef) (organizationCatalog, error) {
	catalog := organizationCatalog{
		byID:   make(map[string]OrganizationRef, len(refs)),
		byName: make(map[string]string, len(refs)),
	}
	for _, ref := range refs {
		ref.ID = strings.TrimSpace(ref.ID)
		ref.Name = strings.TrimSpace(ref.Name)
		if ref.ID == "" || ref.Name == "" {
			return organizationCatalog{}, errors.New("auth: organization catalog contains an empty identity")
		}
		if len(ref.Name) > 120 {
			return organizationCatalog{}, errors.New("auth: organization catalog contains an oversized name")
		}
		nameKey := normalizeOrganizationName(ref.Name)
		if _, exists := catalog.byID[ref.ID]; exists {
			return organizationCatalog{}, errors.New("auth: organization catalog contains duplicate ids")
		}
		if _, exists := catalog.byName[nameKey]; exists {
			return organizationCatalog{}, errors.New("auth: organization catalog contains duplicate names")
		}
		catalog.byID[ref.ID] = ref
		catalog.byName[nameKey] = ref.ID
	}
	return catalog, nil
}

func (c organizationCatalog) register(ref OrganizationRef) error {
	ref.ID = strings.TrimSpace(ref.ID)
	ref.Name = strings.TrimSpace(ref.Name)
	if ref.ID == "" || ref.Name == "" {
		return errors.New("auth: organization identity is required")
	}
	if len(ref.Name) > 120 {
		return errors.New("auth: organization name is too long")
	}
	nameKey := normalizeOrganizationName(ref.Name)
	if existingID, exists := c.byName[nameKey]; exists && existingID != ref.ID {
		return ErrConflict
	}
	if existing, exists := c.byID[ref.ID]; exists {
		delete(c.byName, normalizeOrganizationName(existing.Name))
	}
	c.byID[ref.ID] = ref
	c.byName[nameKey] = ref.ID
	return nil
}

func (c organizationCatalog) clone() organizationCatalog {
	clone := organizationCatalog{
		byID:   make(map[string]OrganizationRef, len(c.byID)),
		byName: make(map[string]string, len(c.byName)),
	}
	for id, ref := range c.byID {
		clone.byID[id] = ref
	}
	for name, id := range c.byName {
		clone.byName[name] = id
	}
	return clone
}

func (c organizationCatalog) remove(id string) {
	id = strings.TrimSpace(id)
	if existing, exists := c.byID[id]; exists {
		delete(c.byName, normalizeOrganizationName(existing.Name))
		delete(c.byID, id)
	}
}

func (c organizationCatalog) idByName(name string) (string, bool) {
	id, exists := c.byName[normalizeOrganizationName(name)]
	return id, exists
}

func (c organizationCatalog) contains(id string) bool {
	_, exists := c.byID[strings.TrimSpace(id)]
	return exists
}

func normalizeOrganizationName(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func migrateOrganizationAssignments(state *persistentState, catalog organizationCatalog) (bool, error) {
	changed := false
	if state.Version == 2 {
		for index := range state.Users {
			user := &state.Users[index]
			if user.Role == RoleAdmin {
				user.AllOrganizations = true
				user.OrganizationIDs = nil
				user.LegacyOrganizations = nil
				continue
			}
			ids := make([]string, 0, len(user.LegacyOrganizations))
			for _, name := range user.LegacyOrganizations {
				name = strings.TrimSpace(name)
				if name == "" {
					continue
				}
				id, exists := catalog.idByName(name)
				if !exists {
					return false, fmt.Errorf("auth: legacy organization %q is not registered", name)
				}
				ids = append(ids, id)
			}
			user.OrganizationIDs = normalizeIDs(ids)
			user.LegacyOrganizations = nil
		}
		state.Version = authStateVersion
		changed = true
	}
	if state.Version != authStateVersion {
		return false, fmt.Errorf("auth: unsupported state version %d", state.Version)
	}
	for index := range state.Users {
		user := &state.Users[index]
		if len(user.LegacyOrganizations) != 0 {
			return false, errors.New("auth: current account state contains legacy organization names")
		}
		if user.Role == RoleAdmin {
			if !user.AllOrganizations || len(user.OrganizationIDs) != 0 {
				user.AllOrganizations = true
				user.OrganizationIDs = nil
				changed = true
			}
			continue
		}
		normalized := normalizeIDs(user.OrganizationIDs)
		registered := normalized[:0]
		for _, id := range normalized {
			if catalog.contains(id) {
				registered = append(registered, id)
				continue
			}
			changed = true // Narrowing an orphaned grant is a fail-closed recovery.
		}
		if !slices.Equal(user.OrganizationIDs, registered) {
			user.OrganizationIDs = slices.Clone(registered)
			changed = true
		}
	}
	return changed, nil
}

func migrateGuestOrganization(
	state *persistentState,
	catalog organizationCatalog,
	guestEnabled bool,
) (bool, error) {
	changed := false
	if state.GuestOrganizationID != "" && !catalog.contains(state.GuestOrganizationID) {
		state.GuestOrganizationID = ""
		changed = true
	}
	if state.GuestOrganizationID != "" {
		return changed, nil
	}
	id, exists := catalog.idByName(GuestOrganizationName)
	if !exists {
		if guestEnabled {
			return false, errors.New("auth: guest organization is required when guest access is enabled")
		}
		return changed, nil
	}
	state.GuestOrganizationID = id
	return true, nil
}

func legacyOrganizationNames(state persistentState) []string {
	names := make([]string, 0)
	seen := make(map[string]struct{})
	for _, user := range state.Users {
		for _, name := range user.LegacyOrganizations {
			name = strings.TrimSpace(name)
			key := normalizeOrganizationName(name)
			if key == "" {
				continue
			}
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			names = append(names, name)
		}
	}
	slices.SortFunc(names, func(left, right string) int {
		return strings.Compare(normalizeOrganizationName(left), normalizeOrganizationName(right))
	})
	return names
}

func preflight(state persistentState) Preflight {
	return Preflight{
		LegacyOrganizationNames: legacyOrganizationNames(state),
		GuestOrganizationID:     strings.TrimSpace(state.GuestOrganizationID),
		LegacyGuestTopologyIDs:  normalizeIDs(state.LegacyGuestTopologyIDs),
	}
}
