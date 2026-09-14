package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"wiredraft/internal/auth"
	"wiredraft/internal/model"
)

func TestDuplicateCopiesPhotosAndPreservesSource(t *testing.T) {
	t.Parallel()
	handler, directory := newPhotoTestHandler(t)
	source := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies",
		map[string]string{"name": "Source", "template": "demo"}, http.StatusCreated)
	source = uploadTestPhotos(t, handler, source, model.PhotoTargetTopology, source.ID, "map.png")
	share := performTestJSONRequest(t, handler, http.MethodPost, "/api/v1/topologies/"+source.ID+"/shares",
		map[string]string{"name": "Source reviewers"})
	if share.Code != http.StatusCreated {
		t.Fatalf("create source share: %d %s", share.Code, share.Body.String())
	}
	source = requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+source.ID, nil, http.StatusOK)
	response := duplicateRequest(t, handler, source, source.Revision)
	if response.Code != http.StatusCreated {
		t.Fatalf("duplicate: %d %s", response.Code, response.Body.String())
	}
	var duplicate model.Topology
	decodeResponse(t, response, &duplicate)
	if duplicate.ID == source.ID || duplicate.Revision != 1 || duplicate.Name != "Copy" || duplicate.OrganizationID != source.OrganizationID {
		t.Fatalf("invalid copy metadata: %#v", duplicate)
	}
	if len(duplicate.Devices) != len(source.Devices) || len(duplicate.Links) != len(source.Links) || len(duplicate.Photos) != 1 {
		t.Fatal("copy lost topology content")
	}
	if duplicate.Photos[0].TargetID != duplicate.ID || len(duplicate.ShareGrants) != 0 {
		t.Fatal("copy retained source map attachment or share reference")
	}
	sourceBytes, err := os.ReadFile(filepath.Join(directory, source.ID, source.Photos[0].ID+".png")) // #nosec G304 -- generated IDs inside t.TempDir.
	if err != nil {
		t.Fatal(err)
	}
	copyBytes, err := os.ReadFile(filepath.Join(directory, duplicate.ID, duplicate.Photos[0].ID+".png")) // #nosec G304 -- generated IDs inside t.TempDir.
	if err != nil || !bytes.Equal(sourceBytes, copyBytes) {
		t.Fatalf("photo copy differs: %v", err)
	}
	deleted := performTestJSONRequest(t, handler, http.MethodDelete, "/api/v1/topologies/"+duplicate.ID, nil)
	if deleted.Code != http.StatusNoContent {
		t.Fatalf("delete copy: %d", deleted.Code)
	}
	if _, err := os.Stat(filepath.Join(directory, source.ID, source.Photos[0].ID+".png")); err != nil {
		t.Fatalf("deleting copy affected source photo: %v", err)
	}
	stored := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+source.ID, nil, http.StatusOK)
	if stored.Revision != source.Revision || stored.Name != source.Name {
		t.Fatal("duplication changed source")
	}
}

func TestDuplicateRespectsGuestOrganizationBoundary(t *testing.T) {
	t.Parallel()
	handler, _, topologyStore := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, GuestEnabled: true,
	})
	privateMaps, err := topologyStore.List(t.Context())
	if err != nil || len(privateMaps) == 0 {
		t.Fatalf("private fixture: %v", err)
	}
	loginResponse := performJSONRequest(t, handler, http.MethodPost, "/api/v1/auth/guest", map[string]any{}, nil)
	cookie := loginResponse.Result().Cookies()[0]
	var login struct {
		Session auth.SessionView `json:"session"`
	}
	decodeResponse(t, loginResponse, &login)
	request := newJSONRequest(t, http.MethodPost, "/api/v1/topologies/"+privateMaps[0].ID+"/duplicate",
		map[string]string{"name": "Unauthorized copy"}, cookie)
	request.Header.Set("Origin", "http://example.com")
	request.Header.Set("X-CSRF-Token", login.Session.CSRFToken)
	request.Header.Set("If-Match", "\"rev-1\"")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("cross-organization duplicate: %d %s", response.Code, response.Body.String())
	}
	if after, err := topologyStore.List(t.Context()); err != nil || len(after) != len(privateMaps) {
		t.Fatal("unauthorized copy created a map")
	}
}

func TestDuplicateRejectsStaleRevisionAndMissingPhoto(t *testing.T) {
	t.Parallel()
	handler, directory := newPhotoTestHandler(t)
	source := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies",
		map[string]string{"name": "Source", "template": "demo"}, http.StatusCreated)
	source = uploadTestPhotos(t, handler, source, model.PhotoTargetDevice, source.Devices[0].ID, "a.png", "b.png")
	if response := duplicateRequest(t, handler, source, source.Revision+1); response.Code != http.StatusConflict {
		t.Fatalf("stale revision status: %d", response.Code)
	}
	if err := os.Remove(filepath.Join(directory, source.ID, source.Photos[1].ID+".png")); err != nil {
		t.Fatal(err)
	}
	if response := duplicateRequest(t, handler, source, source.Revision); response.Code != http.StatusInternalServerError {
		t.Fatalf("missing photo status: %d", response.Code)
	}
	entries, err := os.ReadDir(directory)
	if err != nil || len(entries) != 1 || entries[0].Name() != source.ID {
		t.Fatalf("incomplete media copy remains: %v %v", entries, err)
	}
}

func duplicateRequest(t *testing.T, handler http.Handler, source model.Topology, revision uint64) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"name": "Copy"})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost,
		"/api/v1/topologies/"+source.ID+"/duplicate", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("If-Match", topologyRevisionETag(revision))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}
