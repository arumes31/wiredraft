package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"netdiagram/internal/model"
)

func TestCommentsDocumentationAndReadOnlyShares(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Collaboration", "template": "demo",
	}, http.StatusCreated)

	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/comments", createCommentThreadRequest{
		Anchor: model.CommentAnchor{Kind: model.CommentAnchorDevice, TargetID: topology.Devices[0].ID},
		Author: "Daniel", Body: "Verify the cabling",
	}, http.StatusCreated)
	if len(topology.CommentThreads) != 1 || len(topology.CommentThreads[0].Messages) != 1 {
		t.Fatalf("comment threads = %#v", topology.CommentThreads)
	}
	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/comments/"+topology.CommentThreads[0].ID+"/replies", createCommentReplyRequest{
		Author: "Alex", Body: "Confirmed",
	}, http.StatusCreated)
	if len(topology.CommentThreads[0].Messages) != 2 {
		t.Fatalf("message count = %d, want 2", len(topology.CommentThreads[0].Messages))
	}

	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/documentation-links", model.DocumentationLink{
		TargetKind: model.DocumentationTargetLink, TargetID: topology.Links[0].ID,
		Label: "Runbook", URL: "https://docs.example.test/network/runbook",
	}, http.StatusCreated)
	if len(topology.DocumentationLinks) != 1 {
		t.Fatalf("documentation links = %#v", topology.DocumentationLinks)
	}

	shareBody, err := json.Marshal(createShareGrantRequest{Name: "Auditor"})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/v1/topologies/"+topology.ID+"/shares", bytes.NewReader(shareBody))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("create share status = %d; body = %s", response.Code, response.Body.String())
	}
	var share shareGrantResponse
	if err := json.Unmarshal(response.Body.Bytes(), &share); err != nil {
		t.Fatal(err)
	}
	if len(share.Token) < 40 || share.Path == "" {
		t.Fatalf("share response = %#v", share)
	}

	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodGet, share.Path, nil))
	if response.Code != http.StatusOK {
		t.Fatalf("shared read status = %d; body = %s", response.Code, response.Body.String())
	}
	var shared model.Topology
	if err := json.Unmarshal(response.Body.Bytes(), &shared); err != nil {
		t.Fatal(err)
	}
	if len(shared.ShareGrants) != 0 || len(shared.CommentThreads) != 1 || len(shared.DocumentationLinks) != 1 {
		t.Fatalf("shared topology redaction/content = %#v", shared)
	}

	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodPut, share.Path, bytes.NewReader([]byte(`{}`))))
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("shared mutation status = %d, want 405", response.Code)
	}
}

func TestRevisionConflictReturnsResyncMetadata(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Revision conflict", "template": "demo",
	}, http.StatusCreated)

	body, err := json.Marshal(createCommentThreadRequest{
		Anchor: model.CommentAnchor{Kind: model.CommentAnchorCanvas, X: 40, Y: 80}, Author: "Daniel", Body: "Stale write",
	})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/v1/topologies/"+topology.ID+"/comments", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("If-Match", `"rev-999999"`)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409; body = %s", response.Code, response.Body.String())
	}
	var conflict struct {
		ExpectedRevision uint64 `json:"expectedRevision"`
		CurrentRevision  uint64 `json:"currentRevision"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &conflict); err != nil {
		t.Fatal(err)
	}
	if conflict.ExpectedRevision != 999999 || conflict.CurrentRevision != topology.Revision {
		t.Fatalf("conflict = %#v, want current revision %d", conflict, topology.Revision)
	}
}
