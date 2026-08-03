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
