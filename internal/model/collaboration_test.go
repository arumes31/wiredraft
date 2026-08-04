package model

import (
	"strings"
	"testing"
	"time"
)

func TestDocumentationLinkRejectsUnsafeSchemes(t *testing.T) {
	t.Parallel()
	topology, err := NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	id, err := NewID()
	if err != nil {
		t.Fatal(err)
	}
	topology.DocumentationLinks = append(topology.DocumentationLinks, DocumentationLink{
		ID: id, TargetKind: DocumentationTargetDevice, TargetID: topology.Devices[0].ID,
		Label: "Unsafe", URL: "javascript:alert(1)", CreatedAt: time.Now().UTC(),
	})
	if err := topology.Validate(); err == nil || !strings.Contains(err.Error(), "HTTP(S)") {
		t.Fatalf("Validate() error = %v, want unsafe URL rejection", err)
	}
}

func TestThreadedDeviceCommentValidates(t *testing.T) {
	t.Parallel()
	topology, err := NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	threadID, _ := NewID()
	messageID, _ := NewID()
	now := time.Now().UTC()
	topology.CommentThreads = append(topology.CommentThreads, CommentThread{
		ID: threadID, Anchor: CommentAnchor{Kind: CommentAnchorDevice, TargetID: topology.Devices[0].ID},
		CreatedAt: now, UpdatedAt: now,
		Messages: []CommentMessage{{ID: messageID, Author: "Daniel", Body: "Check this uplink", CreatedAt: now, UpdatedAt: now}},
	})
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestThreadedPortCommentValidates(t *testing.T) {
	t.Parallel()
	topology, err := NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	threadID, _ := NewID()
	messageID, _ := NewID()
	now := time.Now().UTC()
	topology.CommentThreads = append(topology.CommentThreads, CommentThread{
		ID: threadID, Anchor: CommentAnchor{Kind: CommentAnchorPort, TargetID: topology.Devices[0].Ports[0].ID},
		CreatedAt: now, UpdatedAt: now,
		Messages: []CommentMessage{{ID: messageID, Author: "NOC", Body: "Verify the optic before change window", CreatedAt: now, UpdatedAt: now}},
	})
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}

	topology.CommentThreads[0].Anchor.TargetID = "00000000-0000-4000-8000-000000000000"
	if err := topology.Validate(); err == nil || !strings.Contains(err.Error(), "unknown port") {
		t.Fatalf("Validate() error = %v, want unknown port rejection", err)
	}
}
