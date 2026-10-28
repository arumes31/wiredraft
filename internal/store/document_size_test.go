package store

import (
	"errors"
	"strings"
	"testing"
	"time"

	"wiredraft/internal/model"
	"wiredraft/internal/testutil"
)

func TestJSONStoreRejectsOversizedDocuments(t *testing.T) {
	t.Parallel()
	topologyStore, err := NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	topology, err := testutil.GenerateTopology(testutil.TopologyOptions{DeviceCount: 2, PortsPerDevice: 2, VLANCount: 1})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := topologyStore.Create(t.Context(), topology); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	// Every thread and message is individually valid; only the encoded
	// aggregate exceeds model.MaxTopologyDocumentBytes.
	now := time.Date(2025, time.January, 2, 3, 4, 5, 0, time.UTC)
	body := strings.Repeat("x", 3900)
	grow := func(current *model.Topology) error {
		for range 50 {
			thread := model.CommentThread{
				ID:        mustNewID(t),
				Anchor:    model.CommentAnchor{Kind: model.CommentAnchorDevice, TargetID: current.Devices[0].ID},
				CreatedAt: now, UpdatedAt: now,
			}
			for range 100 {
				thread.Messages = append(thread.Messages, model.CommentMessage{
					ID: mustNewID(t), Author: "Auditor", Body: body, CreatedAt: now, UpdatedAt: now,
				})
			}
			current.CommentThreads = append(current.CommentThreads, thread)
		}
		return nil
	}
	_, err = topologyStore.MutateAtRevision(t.Context(), topology.ID, 0, grow)
	if !errors.Is(err, ErrInvalid) || !strings.Contains(err.Error(), "bytes") {
		t.Fatalf("oversized mutation error = %v, want ErrInvalid document size", err)
	}
	stored, err := topologyStore.Get(t.Context(), topology.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(stored.CommentThreads) != 0 {
		t.Fatalf("oversized mutation persisted %d comment threads", len(stored.CommentThreads))
	}

	oversized := topology
	oversized.ID = mustNewID(t)
	if err := grow(&oversized); err != nil {
		t.Fatal(err)
	}
	if _, err := topologyStore.Create(t.Context(), oversized); !errors.Is(err, ErrInvalid) {
		t.Fatalf("oversized Create() error = %v, want ErrInvalid", err)
	}
}

func mustNewID(t *testing.T) string {
	t.Helper()
	id, err := model.NewID()
	if err != nil {
		t.Fatal(err)
	}
	return id
}
