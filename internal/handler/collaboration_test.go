package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
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
	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/comments", createCommentThreadRequest{
		Anchor: model.CommentAnchor{Kind: model.CommentAnchorPort, TargetID: topology.Devices[0].Ports[0].ID},
		Author: "Alex", Body: "Clean this connector",
	}, http.StatusCreated)
	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/comments", createCommentThreadRequest{
		Anchor: model.CommentAnchor{Kind: model.CommentAnchorLink, TargetID: topology.Links[0].ID},
		Author: "NOC", Body: "Change-window dependency",
	}, http.StatusCreated)
	if len(topology.CommentThreads) != 3 || len(topology.CommentThreads[0].Messages) != 1 {
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
	if len(shared.ShareGrants) != 0 || len(shared.CommentThreads) != 3 || len(shared.DocumentationLinks) != 1 {
		t.Fatalf("shared topology redaction/content = %#v", shared)
	}

	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodPut, share.Path, bytes.NewReader([]byte(`{}`))))
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("shared mutation status = %d, want 405", response.Code)
	}

	commentsPath := "/api/v1/topologies/" + topology.ID + "/comments"
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodGet, commentsPath, nil))
	var threads []model.CommentThread
	if err := json.Unmarshal(response.Body.Bytes(), &threads); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusOK || len(threads) != 3 {
		t.Fatalf("list comments status/count = %d/%d", response.Code, len(threads))
	}
	topology = requestTopology(t, handler, http.MethodPut, commentsPath+"/"+threads[0].ID, updateCommentThreadRequest{Resolved: true}, http.StatusOK)
	if !topology.CommentThreads[0].Resolved {
		t.Fatal("comment thread was not resolved")
	}
	topology = requestTopology(t, handler, http.MethodDelete, commentsPath+"/"+threads[2].ID, nil, http.StatusOK)
	if len(topology.CommentThreads) != 2 {
		t.Fatalf("comment threads after delete = %d, want 2", len(topology.CommentThreads))
	}

	documentationPath := "/api/v1/topologies/" + topology.ID + "/documentation-links"
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodGet, documentationPath, nil))
	var documentationLinks []model.DocumentationLink
	if err := json.Unmarshal(response.Body.Bytes(), &documentationLinks); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusOK || len(documentationLinks) != 1 {
		t.Fatalf("list documentation status/count = %d/%d", response.Code, len(documentationLinks))
	}
	topology = requestTopology(t, handler, http.MethodDelete, documentationPath+"/"+documentationLinks[0].ID, nil, http.StatusOK)
	if len(topology.DocumentationLinks) != 0 {
		t.Fatal("documentation link was not deleted")
	}

	sharesPath := "/api/v1/topologies/" + topology.ID + "/shares"
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodGet, sharesPath, nil))
	var shares []shareGrantResponse
	if err := json.Unmarshal(response.Body.Bytes(), &shares); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusOK || len(shares) != 1 || shares[0].Token != "" {
		t.Fatalf("listed shares = %#v; status = %d", shares, response.Code)
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodDelete, sharesPath+"/"+shares[0].ID, nil))
	if response.Code != http.StatusNoContent {
		t.Fatalf("delete share status = %d, want 204", response.Code)
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodGet, share.Path, nil))
	if response.Code != http.StatusNotFound {
		t.Fatalf("revoked share status = %d, want 404", response.Code)
	}
}

func TestDeletingTopologyObjectsPrunesTheirCommentAnchors(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Comment pruning", "template": "demo",
	}, http.StatusCreated)
	deviceID := topology.Devices[0].ID
	portID := topology.Devices[0].Ports[0].ID
	linkID := topology.Links[0].ID

	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/comments", createCommentThreadRequest{
		Anchor: model.CommentAnchor{Kind: model.CommentAnchorPort, TargetID: portID}, Author: "NOC", Body: "Port note",
	}, http.StatusCreated)
	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/comments", createCommentThreadRequest{
		Anchor: model.CommentAnchor{Kind: model.CommentAnchorLink, TargetID: linkID}, Author: "NOC", Body: "Cable note",
	}, http.StatusCreated)

	topology = requestTopology(t, handler, http.MethodDelete, "/api/v1/topologies/"+topology.ID+"/links/"+linkID, nil, http.StatusOK)
	if len(topology.CommentThreads) != 1 || topology.CommentThreads[0].Anchor.Kind != model.CommentAnchorPort {
		t.Fatalf("threads after link deletion = %#v, want only port comment", topology.CommentThreads)
	}
	topology = requestTopology(t, handler, http.MethodDelete, "/api/v1/topologies/"+topology.ID+"/devices/"+deviceID, nil, http.StatusOK)
	if len(topology.CommentThreads) != 0 {
		t.Fatalf("threads after device deletion = %#v, want none", topology.CommentThreads)
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

func TestConcurrentEditorsCommitExactlyOneRevision(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Concurrent editors", "template": "blank",
	}, http.StatusCreated)

	const rounds = 32
	for round := range rounds {
		before := topology
		start := make(chan struct{})
		statuses := make(chan int, 2)
		for writer := range 2 {
			writer := writer
			go func() {
				body, err := json.Marshal(createCommentThreadRequest{
					Anchor: model.CommentAnchor{Kind: model.CommentAnchorCanvas, X: float64(round), Y: float64(writer)},
					Author: fmt.Sprintf("editor-%d", writer),
					Body:   fmt.Sprintf("round-%d", round),
				})
				if err != nil {
					statuses <- 0
					return
				}
				<-start
				request := httptest.NewRequestWithContext(
					t.Context(),
					http.MethodPost,
					"/api/v1/topologies/"+before.ID+"/comments",
					bytes.NewReader(body),
				)
				request.Header.Set("Content-Type", "application/json")
				request.Header.Set("If-Match", topologyRevisionETag(before.Revision))
				response := httptest.NewRecorder()
				handler.ServeHTTP(response, request)
				statuses <- response.Code
			}()
		}
		close(start)
		successes := 0
		conflicts := 0
		for range 2 {
			switch status := <-statuses; status {
			case http.StatusCreated:
				successes++
			case http.StatusConflict:
				conflicts++
			default:
				t.Fatalf("round %d unexpected status = %d", round, status)
			}
		}
		if successes != 1 || conflicts != 1 {
			t.Fatalf("round %d outcomes = %d success / %d conflict, want 1 / 1", round, successes, conflicts)
		}

		topology = requestTopology(
			t,
			handler,
			http.MethodGet,
			"/api/v1/topologies/"+before.ID,
			nil,
			http.StatusOK,
		)
		if topology.Revision != before.Revision+1 {
			t.Fatalf("round %d revision = %d, want %d", round, topology.Revision, before.Revision+1)
		}
		if len(topology.CommentThreads) != round+1 {
			t.Fatalf("round %d comments = %d, want %d", round, len(topology.CommentThreads), round+1)
		}
	}
}
