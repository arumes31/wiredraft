package store

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"wiredraft/internal/model"
)

const maxTopologyFileSize = 32 << 20

const organizationRegistryFile = ".wiredraft-organizations.json"

// JSONStore keeps validated snapshots in memory and atomically persists mutations.
type JSONStore struct {
	dataDir       string
	mu            sync.RWMutex
	writeMu       sync.Mutex
	topologies    map[string]model.Topology
	organizations map[string]Organization
}

var _ Store = (*JSONStore)(nil)

// NewJSONStore loads existing topology files and creates a demo on an empty store.
func NewJSONStore(dataDir string) (*JSONStore, error) {
	if err := os.MkdirAll(dataDir, 0o750); err != nil {
		return nil, fmt.Errorf("creating data directory: %w", err)
	}
	store := &JSONStore{
		dataDir:       dataDir,
		topologies:    make(map[string]model.Topology),
		organizations: make(map[string]Organization),
	}
	if err := store.loadOrganizations(); err != nil {
		return nil, err
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	if err := store.EnsureOrganizations(context.Background(), nil); err != nil {
		return nil, fmt.Errorf("ensuring organizations: %w", err)
	}
	if len(store.topologies) == 0 {
		demo, err := model.NewDemo()
		if err != nil {
			return nil, fmt.Errorf("creating demo topology: %w", err)
		}
		if _, err := store.Create(context.Background(), demo); err != nil {
			return nil, fmt.Errorf("persisting demo topology: %w", err)
		}
	}
	return store, nil
}

// EnsureOrganizations creates Default, registers legacy names, and upgrades
// loaded topology documents to stable organization IDs.
func (s *JSONStore) EnsureOrganizations(_ context.Context, legacyOrganizationNames []string) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	s.mu.Lock()
	if _, exists := s.organizations[model.DefaultOrganizationID]; !exists {
		now := time.Now().UTC()
		s.organizations[model.DefaultOrganizationID] = Organization{
			ID: model.DefaultOrganizationID, Name: model.DefaultOrganizationName,
			IsDefault: true, CreatedAt: now, UpdatedAt: now,
		}
	}
	for _, candidate := range legacyOrganizationNames {
		name, err := normalizeOrganizationName(candidate)
		if err != nil {
			s.mu.Unlock()
			return err
		}
		if _, exists := s.findOrganizationByNameLocked(name); exists {
			continue
		}
		organization, err := newOrganization(name)
		if err != nil {
			s.mu.Unlock()
			return err
		}
		s.organizations[organization.ID] = organization
	}
	for id, topology := range s.topologies {
		organization, exists := s.organizations[topology.OrganizationID]
		if !exists {
			s.mu.Unlock()
			return fmt.Errorf("%w: topology %q references unknown organization", ErrInvalid, id)
		}
		topology.OrganizationID = organization.ID
		topology.Organization = organization.Name
		s.topologies[id] = topology
	}
	organizations := cloneOrganizations(s.organizations)
	topologies := make([]model.Topology, 0, len(s.topologies))
	for _, topology := range s.topologies {
		topologies = append(topologies, topology)
	}
	s.mu.Unlock()

	if err := s.writeOrganizations(organizations); err != nil {
		return err
	}
	for _, topology := range topologies {
		if err := s.writeTopology(topology); err != nil {
			return fmt.Errorf("upgrading topology organization: %w", err)
		}
	}
	return nil
}

// ListOrganizations returns Default first, followed by names case-insensitively.
func (s *JSONStore) ListOrganizations(_ context.Context) ([]Organization, error) {
	s.mu.RLock()
	organizations := make([]Organization, 0, len(s.organizations))
	for _, organization := range s.organizations {
		organizations = append(organizations, organization)
	}
	s.mu.RUnlock()
	slices.SortFunc(organizations, func(left, right Organization) int {
		if left.IsDefault != right.IsDefault {
			if left.IsDefault {
				return -1
			}
			return 1
		}
		return strings.Compare(strings.ToLower(left.Name), strings.ToLower(right.Name))
	})
	return organizations, nil
}

// GetOrganization resolves one organization by stable ID.
func (s *JSONStore) GetOrganization(_ context.Context, id string) (Organization, error) {
	id, err := validateOrganizationID(id)
	if err != nil {
		return Organization{}, err
	}
	s.mu.RLock()
	organization, exists := s.organizations[id]
	s.mu.RUnlock()
	if !exists {
		return Organization{}, ErrNotFound
	}
	return organization, nil
}

// FindOrganizationByName performs a case-insensitive registry lookup.
func (s *JSONStore) FindOrganizationByName(_ context.Context, name string) (Organization, error) {
	name, err := normalizeOrganizationName(name)
	if err != nil {
		return Organization{}, err
	}
	s.mu.RLock()
	organization, exists := s.findOrganizationByNameLocked(name)
	s.mu.RUnlock()
	if !exists {
		return Organization{}, ErrNotFound
	}
	return organization, nil
}

// CreateOrganization inserts a new organization with a stable random ID.
func (s *JSONStore) CreateOrganization(_ context.Context, name string) (Organization, error) {
	name, err := normalizeOrganizationName(name)
	if err != nil {
		return Organization{}, err
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	s.mu.RLock()
	if _, exists := s.findOrganizationByNameLocked(name); exists {
		s.mu.RUnlock()
		return Organization{}, ErrConflict
	}
	organizations := cloneOrganizations(s.organizations)
	s.mu.RUnlock()
	organization, err := newOrganization(name)
	if err != nil {
		return Organization{}, err
	}
	organizations[organization.ID] = organization
	if err := s.writeOrganizations(organizations); err != nil {
		return Organization{}, err
	}
	s.mu.Lock()
	s.organizations[organization.ID] = organization
	s.mu.Unlock()
	return organization, nil
}

// RenameOrganization changes a display name and keeps the stable ID.
func (s *JSONStore) RenameOrganization(_ context.Context, id string, name string) (Organization, error) {
	id, err := validateOrganizationID(id)
	if err != nil {
		return Organization{}, err
	}
	name, err = normalizeOrganizationName(name)
	if err != nil {
		return Organization{}, err
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	s.mu.RLock()
	organization, exists := s.organizations[id]
	if !exists {
		s.mu.RUnlock()
		return Organization{}, ErrNotFound
	}
	if organization.IsDefault {
		s.mu.RUnlock()
		return Organization{}, ErrProtectedOrganization
	}
	if duplicate, exists := s.findOrganizationByNameLocked(name); exists && duplicate.ID != id {
		s.mu.RUnlock()
		return Organization{}, ErrConflict
	}
	organization.Name = name
	organization.UpdatedAt = time.Now().UTC()
	organizations := cloneOrganizations(s.organizations)
	organizations[id] = organization
	changed := make([]model.Topology, 0)
	previous := make([]model.Topology, 0)
	for _, topology := range s.topologies {
		if topology.OrganizationID != id {
			continue
		}
		previous = append(previous, topology)
		topology.Organization = name
		changed = append(changed, topology)
	}
	s.mu.RUnlock()
	for index, topology := range changed {
		if err := s.writeTopology(topology); err != nil {
			return Organization{}, errors.Join(
				fmt.Errorf("updating topology organization name: %w", err),
				s.restoreTopologyFiles(previous[:index]),
			)
		}
	}
	if err := s.writeOrganizations(organizations); err != nil {
		return Organization{}, errors.Join(err, s.restoreTopologyFiles(previous))
	}
	s.mu.Lock()
	s.organizations[id] = organization
	for _, topology := range changed {
		s.topologies[topology.ID] = topology
	}
	s.mu.Unlock()
	return organization, nil
}

// DeleteOrganization removes an unused organization. Default is protected.
func (s *JSONStore) DeleteOrganization(_ context.Context, id string) error {
	id, err := validateOrganizationID(id)
	if err != nil {
		return err
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	s.mu.RLock()
	organization, exists := s.organizations[id]
	if !exists {
		s.mu.RUnlock()
		return ErrNotFound
	}
	if organization.IsDefault {
		s.mu.RUnlock()
		return ErrProtectedOrganization
	}
	for _, topology := range s.topologies {
		if topology.OrganizationID == id {
			s.mu.RUnlock()
			return ErrOrganizationInUse
		}
	}
	organizations := cloneOrganizations(s.organizations)
	delete(organizations, id)
	s.mu.RUnlock()
	if err := s.writeOrganizations(organizations); err != nil {
		return err
	}
	s.mu.Lock()
	delete(s.organizations, id)
	s.mu.Unlock()
	return nil
}

// List returns summary snapshots ordered by most recent update.
func (s *JSONStore) List(_ context.Context) ([]model.Summary, error) {
	s.mu.RLock()
	summaries := make([]model.Summary, 0, len(s.topologies))
	for _, topology := range s.topologies {
		summaries = append(summaries, model.Summary{
			ID:             topology.ID,
			Name:           topology.Name,
			OrganizationID: topology.OrganizationID,
			Organization:   topology.Organization,
			Location:       topology.Location,
			RackCount:      len(topology.Racks),
			DeviceCount:    topology.LogicalDeviceCount(),
			LinkCount:      len(topology.Links),
			UpdatedAt:      topology.UpdatedAt,
		})
	}
	s.mu.RUnlock()
	slices.SortFunc(summaries, func(left, right model.Summary) int {
		return right.UpdatedAt.Compare(left.UpdatedAt)
	})
	return summaries, nil
}

// Get returns a defensive snapshot of one topology.
func (s *JSONStore) Get(_ context.Context, id string) (model.Topology, error) {
	s.mu.RLock()
	topology, exists := s.topologies[id]
	s.mu.RUnlock()
	if !exists {
		return model.Topology{}, ErrNotFound
	}
	clone, err := topology.Clone()
	if err != nil {
		return model.Topology{}, fmt.Errorf("copying topology: %w", err)
	}
	return clone, nil
}

// Create validates and durably inserts a topology.
func (s *JSONStore) Create(_ context.Context, topology model.Topology) (model.Topology, error) {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	s.mu.RLock()
	organization, organizationExists := s.organizations[strings.TrimSpace(topology.OrganizationID)]
	s.mu.RUnlock()
	if !organizationExists {
		return model.Topology{}, fmt.Errorf("%w: unknown organization", ErrInvalid)
	}
	topology.OrganizationID = organization.ID
	topology.Organization = organization.Name
	topology.Normalize()
	if err := topology.Validate(); err != nil {
		return model.Topology{}, fmt.Errorf("%w: %w", ErrInvalid, err)
	}
	s.mu.RLock()
	_, exists := s.topologies[topology.ID]
	s.mu.RUnlock()
	if exists {
		return model.Topology{}, ErrConflict
	}
	if err := s.writeTopology(topology); err != nil {
		return model.Topology{}, err
	}
	s.mu.Lock()
	s.topologies[topology.ID] = topology
	s.mu.Unlock()
	return topology.Clone()
}

// Delete durably removes one topology snapshot.
func (s *JSONStore) Delete(ctx context.Context, id string) error {
	return s.DeleteAtRevision(ctx, id, 0, nil)
}

// DeleteAtRevision authorizes and removes the exact serialized snapshot.
// An expected revision of zero disables the optimistic concurrency precondition.
func (s *JSONStore) DeleteAtRevision(
	_ context.Context,
	id string,
	expectedRevision uint64,
	authorize func(model.Topology) error,
) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	s.mu.RLock()
	current, exists := s.topologies[id]
	s.mu.RUnlock()
	if !exists {
		return ErrNotFound
	}
	if expectedRevision != 0 && current.Revision != expectedRevision {
		return &RevisionConflictError{Expected: expectedRevision, Actual: current.Revision}
	}
	if authorize != nil {
		snapshot, err := current.Clone()
		if err != nil {
			return fmt.Errorf("copying topology for deletion: %w", err)
		}
		if err := authorize(snapshot); err != nil {
			return err
		}
	}
	if err := os.Remove(filepath.Join(s.dataDir, id+".json")); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return ErrNotFound
		}
		return fmt.Errorf("deleting topology: %w", err)
	}
	s.mu.Lock()
	delete(s.topologies, id)
	s.mu.Unlock()
	return nil
}

// Mutate applies one serialized transaction and publishes it only after durable persistence.
func (s *JSONStore) Mutate(
	ctx context.Context,
	id string,
	mutation func(*model.Topology) error,
) (model.Topology, error) {
	return s.MutateAtRevision(ctx, id, 0, mutation)
}

// MutateAtRevision applies a mutation only when the persisted revision matches.
// An expected revision of zero disables the optimistic concurrency precondition.
func (s *JSONStore) MutateAtRevision(
	_ context.Context,
	id string,
	expectedRevision uint64,
	mutation func(*model.Topology) error,
) (model.Topology, error) {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	s.mu.RLock()
	current, exists := s.topologies[id]
	s.mu.RUnlock()
	if !exists {
		return model.Topology{}, ErrNotFound
	}
	if expectedRevision != 0 && current.Revision != expectedRevision {
		return model.Topology{}, &RevisionConflictError{Expected: expectedRevision, Actual: current.Revision}
	}
	next, err := current.Clone()
	if err != nil {
		return model.Topology{}, fmt.Errorf("copying topology for mutation: %w", err)
	}
	if err := mutation(&next); err != nil {
		return model.Topology{}, err
	}
	s.mu.RLock()
	organization, organizationExists := s.organizations[strings.TrimSpace(next.OrganizationID)]
	s.mu.RUnlock()
	if !organizationExists {
		return model.Topology{}, fmt.Errorf("%w: unknown organization", ErrInvalid)
	}
	next.OrganizationID = organization.ID
	next.Organization = organization.Name
	next.Revision = current.Revision + 1
	next.UpdatedAt = time.Now().UTC()
	next.Normalize()
	if err := next.Validate(); err != nil {
		return model.Topology{}, fmt.Errorf("%w: %w", ErrInvalid, err)
	}
	if err := s.writeTopology(next); err != nil {
		return model.Topology{}, err
	}
	s.mu.Lock()
	s.topologies[id] = next
	s.mu.Unlock()
	return next.Clone()
}

// SaveToDisk atomically rewrites the current snapshot for one topology.
func (s *JSONStore) SaveToDisk(id string) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	s.mu.RLock()
	topology, exists := s.topologies[id]
	s.mu.RUnlock()
	if !exists {
		return ErrNotFound
	}
	if err := s.writeTopology(topology); err != nil {
		return err
	}
	return nil
}

func (s *JSONStore) load() (returnErr error) {
	root, err := os.OpenRoot(s.dataDir)
	if err != nil {
		return fmt.Errorf("opening data directory root: %w", err)
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil && returnErr == nil {
			returnErr = fmt.Errorf("closing data directory root: %w", closeErr)
		}
	}()
	entries, err := fs.ReadDir(root.FS(), ".")
	if err != nil {
		return fmt.Errorf("reading data directory: %w", err)
	}
	for _, entry := range entries {
		if entry.IsDir() || entry.Name() == organizationRegistryFile || strings.ToLower(filepath.Ext(entry.Name())) != ".json" {
			continue
		}
		topology, decodeErr := decodeTopologyFile(root, entry.Name(), s.resolveLoadedOrganization)
		if decodeErr != nil {
			return fmt.Errorf("loading %q: %w", entry.Name(), decodeErr)
		}
		if _, exists := s.topologies[topology.ID]; exists {
			return fmt.Errorf("loading %q: duplicate topology id %q", entry.Name(), topology.ID)
		}
		s.topologies[topology.ID] = topology
	}
	return nil
}

func decodeTopologyFile(
	root *os.Root,
	name string,
	resolveOrganization func(string, string) (Organization, error),
) (topology model.Topology, returnErr error) {
	file, err := root.Open(name)
	if err != nil {
		return model.Topology{}, fmt.Errorf("opening topology: %w", err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil && returnErr == nil {
			returnErr = fmt.Errorf("closing topology: %w", closeErr)
		}
	}()
	decoder := json.NewDecoder(io.LimitReader(file, maxTopologyFileSize))
	var document map[string]json.RawMessage
	if err := decoder.Decode(&document); err != nil {
		return model.Topology{}, fmt.Errorf("decoding topology: %w", err)
	}
	if err := ensureJSONEOF(decoder); err != nil {
		return model.Topology{}, err
	}
	var organizationID string
	if raw := document["organizationId"]; raw != nil {
		if err := json.Unmarshal(raw, &organizationID); err != nil {
			return model.Topology{}, fmt.Errorf("decoding topology organization id: %w", err)
		}
	}
	var organizationName string
	if raw := document["organization"]; raw != nil {
		if err := json.Unmarshal(raw, &organizationName); err != nil {
			return model.Topology{}, fmt.Errorf("decoding topology organization: %w", err)
		}
	}
	organization, err := resolveOrganization(organizationID, organizationName)
	if err != nil {
		return model.Topology{}, err
	}
	document["organizationId"], err = json.Marshal(organization.ID)
	if err != nil {
		return model.Topology{}, fmt.Errorf("encoding migrated organization id: %w", err)
	}
	document["organization"], err = json.Marshal(organization.Name)
	if err != nil {
		return model.Topology{}, fmt.Errorf("encoding migrated organization: %w", err)
	}
	migrated, err := json.Marshal(document)
	if err != nil {
		return model.Topology{}, fmt.Errorf("encoding migrated topology: %w", err)
	}
	strictDecoder := json.NewDecoder(bytes.NewReader(migrated))
	strictDecoder.DisallowUnknownFields()
	if err := strictDecoder.Decode(&topology); err != nil {
		return model.Topology{}, fmt.Errorf("decoding migrated topology: %w", err)
	}
	if err := ensureJSONEOF(strictDecoder); err != nil {
		return model.Topology{}, err
	}
	return topology, nil
}

func (s *JSONStore) writeTopology(topology model.Topology) (returnErr error) {
	temporary, err := os.CreateTemp(s.dataDir, "topology-*.tmp")
	if err != nil {
		return fmt.Errorf("creating temporary topology: %w", err)
	}
	temporaryName := temporary.Name()
	isClosed := false
	defer func() {
		if !isClosed {
			closeErr := temporary.Close()
			if closeErr != nil && returnErr == nil {
				returnErr = fmt.Errorf("closing temporary topology: %w", closeErr)
			}
		}
		if returnErr != nil {
			_ = os.Remove(temporaryName)
		}
	}()
	if err := temporary.Chmod(0o600); err != nil {
		return fmt.Errorf("setting topology permissions: %w", err)
	}
	buffered := bufio.NewWriterSize(temporary, 64<<10)
	encoder := json.NewEncoder(buffered)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(topology); err != nil {
		return fmt.Errorf("encoding topology: %w", err)
	}
	if err := buffered.Flush(); err != nil {
		return fmt.Errorf("flushing topology buffer: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return fmt.Errorf("synchronizing topology: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("closing topology before rename: %w", err)
	}
	isClosed = true
	target := filepath.Join(s.dataDir, topology.ID+".json")
	if err := os.Rename(temporaryName, target); err != nil {
		return fmt.Errorf("atomically replacing topology: %w", err)
	}
	return nil
}

func (s *JSONStore) restoreTopologyFiles(topologies []model.Topology) error {
	var restoreErr error
	for _, topology := range topologies {
		if err := s.writeTopology(topology); err != nil {
			restoreErr = errors.Join(restoreErr, fmt.Errorf("restoring topology %q: %w", topology.ID, err))
		}
	}
	return restoreErr
}

func ensureJSONEOF(decoder *json.Decoder) error {
	var extra json.RawMessage
	if err := decoder.Decode(&extra); errors.Is(err, io.EOF) {
		return nil
	} else if err != nil {
		return fmt.Errorf("checking trailing topology data: %w", err)
	}
	return errors.New("topology contains multiple json values")
}

func (s *JSONStore) loadOrganizations() (returnErr error) {
	root, err := os.OpenRoot(s.dataDir)
	if err != nil {
		return fmt.Errorf("opening organization registry root: %w", err)
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil && returnErr == nil {
			returnErr = fmt.Errorf("closing organization registry root: %w", closeErr)
		}
	}()
	file, err := root.Open(organizationRegistryFile)
	if errors.Is(err, os.ErrNotExist) {
		now := time.Now().UTC()
		s.organizations[model.DefaultOrganizationID] = Organization{
			ID: model.DefaultOrganizationID, Name: model.DefaultOrganizationName,
			IsDefault: true, CreatedAt: now, UpdatedAt: now,
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("opening organization registry: %w", err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil && returnErr == nil {
			returnErr = fmt.Errorf("closing organization registry: %w", closeErr)
		}
	}()
	decoder := json.NewDecoder(io.LimitReader(file, maxTopologyFileSize))
	decoder.DisallowUnknownFields()
	var organizations []Organization
	if err := decoder.Decode(&organizations); err != nil {
		return fmt.Errorf("decoding organization registry: %w", err)
	}
	if err := ensureJSONEOF(decoder); err != nil {
		return fmt.Errorf("checking organization registry: %w", err)
	}
	names := make(map[string]string, len(organizations))
	for _, organization := range organizations {
		id, err := validateOrganizationID(organization.ID)
		if err != nil {
			return fmt.Errorf("validating organization registry: %w", err)
		}
		name, err := normalizeOrganizationName(organization.Name)
		if err != nil {
			return fmt.Errorf("validating organization registry: %w", err)
		}
		if organization.CreatedAt.IsZero() || organization.UpdatedAt.IsZero() {
			return errors.New("validating organization registry: timestamps must be set")
		}
		key := strings.ToLower(name)
		if previousID, exists := names[key]; exists && previousID != id {
			return fmt.Errorf("validating organization registry: duplicate name %q", name)
		}
		if _, exists := s.organizations[id]; exists {
			return fmt.Errorf("validating organization registry: duplicate id %q", id)
		}
		organization.ID = id
		organization.Name = name
		s.organizations[id] = organization
		names[key] = id
	}
	defaultOrganization, exists := s.organizations[model.DefaultOrganizationID]
	if !exists || !defaultOrganization.IsDefault || defaultOrganization.Name != model.DefaultOrganizationName {
		return errors.New("validating organization registry: protected Default organization is missing")
	}
	for _, organization := range s.organizations {
		if organization.IsDefault && organization.ID != model.DefaultOrganizationID {
			return errors.New("validating organization registry: multiple default organizations")
		}
	}
	return nil
}

func (s *JSONStore) resolveLoadedOrganization(id string, name string) (Organization, error) {
	id = strings.TrimSpace(id)
	name = strings.TrimSpace(name)
	if id != "" {
		validatedID, err := validateOrganizationID(id)
		if err != nil {
			return Organization{}, err
		}
		if organization, exists := s.organizations[validatedID]; exists {
			return organization, nil
		}
		validatedName, err := normalizeOrganizationName(name)
		if err != nil {
			return Organization{}, fmt.Errorf("%w: organization name is required for an unknown id", ErrInvalid)
		}
		if duplicate, exists := s.findOrganizationByNameLocked(validatedName); exists {
			return Organization{}, fmt.Errorf(
				"%w: organization name %q already belongs to %s", ErrConflict, validatedName, duplicate.ID,
			)
		}
		now := time.Now().UTC()
		organization := Organization{
			ID: validatedID, Name: validatedName, CreatedAt: now, UpdatedAt: now,
		}
		if validatedID == model.DefaultOrganizationID || strings.EqualFold(validatedName, model.DefaultOrganizationName) {
			return Organization{}, errors.New("store: invalid protected Default organization identity")
		}
		s.organizations[validatedID] = organization
		return organization, nil
	}
	if name == "" {
		return s.organizations[model.DefaultOrganizationID], nil
	}
	if organization, exists := s.findOrganizationByNameLocked(name); exists {
		return organization, nil
	}
	organization, err := newOrganization(name)
	if err != nil {
		return Organization{}, err
	}
	s.organizations[organization.ID] = organization
	return organization, nil
}

func (s *JSONStore) findOrganizationByNameLocked(name string) (Organization, bool) {
	for _, organization := range s.organizations {
		if strings.EqualFold(organization.Name, strings.TrimSpace(name)) {
			return organization, true
		}
	}
	return Organization{}, false
}

func newOrganization(name string) (Organization, error) {
	name, err := normalizeOrganizationName(name)
	if err != nil {
		return Organization{}, err
	}
	id, err := model.NewID()
	if err != nil {
		return Organization{}, fmt.Errorf("generating organization id: %w", err)
	}
	now := time.Now().UTC()
	return Organization{ID: id, Name: name, CreatedAt: now, UpdatedAt: now}, nil
}

func cloneOrganizations(source map[string]Organization) map[string]Organization {
	clone := make(map[string]Organization, len(source))
	for id, organization := range source {
		clone[id] = organization
	}
	return clone
}

func (s *JSONStore) writeOrganizations(source map[string]Organization) (returnErr error) {
	organizations := make([]Organization, 0, len(source))
	for _, organization := range source {
		organizations = append(organizations, organization)
	}
	slices.SortFunc(organizations, func(left, right Organization) int {
		return strings.Compare(left.ID, right.ID)
	})
	temporary, err := os.CreateTemp(s.dataDir, "organizations-*.tmp")
	if err != nil {
		return fmt.Errorf("creating temporary organization registry: %w", err)
	}
	temporaryName := temporary.Name()
	isClosed := false
	defer func() {
		if !isClosed {
			if closeErr := temporary.Close(); closeErr != nil && returnErr == nil {
				returnErr = fmt.Errorf("closing temporary organization registry: %w", closeErr)
			}
		}
		if returnErr != nil {
			_ = os.Remove(temporaryName)
		}
	}()
	if err := temporary.Chmod(0o600); err != nil {
		return fmt.Errorf("setting organization registry permissions: %w", err)
	}
	encoder := json.NewEncoder(temporary)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(organizations); err != nil {
		return fmt.Errorf("encoding organization registry: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return fmt.Errorf("synchronizing organization registry: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("closing organization registry before rename: %w", err)
	}
	isClosed = true
	if err := os.Rename(temporaryName, filepath.Join(s.dataDir, organizationRegistryFile)); err != nil {
		return fmt.Errorf("atomically replacing organization registry: %w", err)
	}
	return nil
}
