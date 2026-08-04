package store

import (
	"bufio"
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

	"netdiagram/internal/model"
)

const maxTopologyFileSize = 32 << 20

// JSONStore keeps validated snapshots in memory and atomically persists mutations.
type JSONStore struct {
	dataDir    string
	mu         sync.RWMutex
	writeMu    sync.Mutex
	topologies map[string]model.Topology
}

var _ Store = (*JSONStore)(nil)

// NewJSONStore loads existing topology files and creates a demo on an empty store.
func NewJSONStore(dataDir string) (*JSONStore, error) {
	if err := os.MkdirAll(dataDir, 0o750); err != nil {
		return nil, fmt.Errorf("creating data directory: %w", err)
	}
	store := &JSONStore{
		dataDir:    dataDir,
		topologies: make(map[string]model.Topology),
	}
	if err := store.load(); err != nil {
		return nil, err
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

// List returns summary snapshots ordered by most recent update.
func (s *JSONStore) List(_ context.Context) ([]model.Summary, error) {
	s.mu.RLock()
	summaries := make([]model.Summary, 0, len(s.topologies))
	for _, topology := range s.topologies {
		summaries = append(summaries, model.Summary{
			ID:           topology.ID,
			Name:         topology.Name,
			Organization: topology.Organization,
			Location:     topology.Location,
			RackCount:    len(topology.Racks),
			DeviceCount:  topology.LogicalDeviceCount(),
			LinkCount:    len(topology.Links),
			UpdatedAt:    topology.UpdatedAt,
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
		if entry.IsDir() || strings.ToLower(filepath.Ext(entry.Name())) != ".json" {
			continue
		}
		topology, decodeErr := decodeTopologyFile(root, entry.Name())
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

func decodeTopologyFile(root *os.Root, name string) (topology model.Topology, returnErr error) {
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
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&topology); err != nil {
		return model.Topology{}, fmt.Errorf("decoding topology: %w", err)
	}
	if err := ensureJSONEOF(decoder); err != nil {
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

func ensureJSONEOF(decoder *json.Decoder) error {
	var extra json.RawMessage
	if err := decoder.Decode(&extra); errors.Is(err, io.EOF) {
		return nil
	} else if err != nil {
		return fmt.Errorf("checking trailing topology data: %w", err)
	}
	return errors.New("topology contains multiple json values")
}
