package handler

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io/fs"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"netdiagram/internal/media"
	"netdiagram/internal/model"
	"netdiagram/internal/sse"
	"netdiagram/internal/store"
	webassets "netdiagram/web"
)

func TestPhotoUploadReadEditAndDelete(t *testing.T) {
	t.Parallel()
	handler, mediaDirectory := newPhotoTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Photo lifecycle", "template": "demo",
	}, http.StatusCreated)
	device := topology.Devices[0]
	topology = uploadTestPhotos(t, handler, topology, model.PhotoTargetDevice, device.ID, "front.png", "rear.png")
	if len(topology.Photos) != 2 {
		t.Fatalf("photo count = %d, want 2", len(topology.Photos))
	}
	for _, photo := range topology.Photos {
		if photo.ID == "front" || photo.ID == "rear" {
			t.Fatalf("photo ID %q must be randomized", photo.ID)
		}
		if _, err := os.Stat(filepath.Join(mediaDirectory, topology.ID, photo.ID+".png")); err != nil {
			t.Fatalf("randomized photo file is missing: %v", err)
		}
	}

	photo := topology.Photos[0]
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet,
		"/api/v1/topologies/"+topology.ID+"/photos/"+photo.ID, nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || response.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("photo response = %d %q, want 200 image/png", response.Code, response.Header().Get("Content-Type"))
	}
	if response.Header().Get("Cache-Control") != "private, max-age=300" {
		t.Fatalf("Cache-Control = %q, want private media cache", response.Header().Get("Cache-Control"))
	}

	topology = requestTopology(t, handler, http.MethodPut,
		"/api/v1/topologies/"+topology.ID+"/photos/"+photo.ID,
		map[string]string{"originalName": "cabinet-front.png", "caption": "Cabinet before maintenance"}, http.StatusOK)
	if topology.Photos[0].OriginalName != "cabinet-front.png" || topology.Photos[0].Caption != "Cabinet before maintenance" {
		t.Fatalf("updated photo = %#v", topology.Photos[0])
	}
	topology = requestTopology(t, handler, http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/photos/"+photo.ID, nil, http.StatusOK)
	if len(topology.Photos) != 1 {
		t.Fatalf("photo count after delete = %d, want 1", len(topology.Photos))
	}
	if _, err := os.Stat(filepath.Join(mediaDirectory, topology.ID, photo.ID+".png")); !os.IsNotExist(err) {
		t.Fatalf("deleted photo file still exists: %v", err)
	}
}

func TestPhotoFilesFollowObjectAndTopologyLifecycle(t *testing.T) {
	t.Parallel()
	handler, mediaDirectory := newPhotoTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Cleanup lifecycle", "template": "demo",
	}, http.StatusCreated)
	device := topology.Devices[0]
	topology = uploadTestPhotos(t, handler, topology, model.PhotoTargetDevice, device.ID, "device.png")
	devicePhoto := topology.Photos[0]
	topology = requestTopology(t, handler, http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/devices/"+device.ID, nil, http.StatusOK)
	if len(topology.Photos) != 0 {
		t.Fatalf("photos after object delete = %d, want 0", len(topology.Photos))
	}
	if _, err := os.Stat(filepath.Join(mediaDirectory, topology.ID, devicePhoto.ID+".png")); !os.IsNotExist(err) {
		t.Fatalf("object photo file still exists: %v", err)
	}

	topology = uploadTestPhotos(t, handler, topology, model.PhotoTargetTopology, topology.ID, "map.png")
	request := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/api/v1/topologies/"+topology.ID, nil)
	request.Header.Set("If-Match", topologyRevisionETag(topology.Revision))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("delete topology status = %d, want 204; body = %s", response.Code, response.Body.String())
	}
	if _, err := os.Stat(filepath.Join(mediaDirectory, topology.ID)); !os.IsNotExist(err) {
		t.Fatalf("topology media directory still exists: %v", err)
	}
}

func TestPhotoAPIRejectsInvalidRequests(t *testing.T) {
	t.Parallel()
	withoutMedia := newTestHandler(t)
	unavailableRequest := httptest.NewRequestWithContext(t.Context(), http.MethodPost,
		"/api/v1/topologies/00000000-0000-4000-8000-000000000000/photos", nil)
	unavailable := httptest.NewRecorder()
	withoutMedia.ServeHTTP(unavailable, unavailableRequest)
	if unavailable.Code != http.StatusServiceUnavailable {
		t.Fatalf("upload without media status = %d, want 503", unavailable.Code)
	}

	handler, _ := newPhotoTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Rejected photos", "template": "demo",
	}, http.StatusCreated)
	invalidMultipart := httptest.NewRequestWithContext(t.Context(), http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/photos", bytes.NewBufferString("not multipart"))
	invalidMultipart.Header.Set("Content-Type", "application/json")
	invalidResponse := httptest.NewRecorder()
	handler.ServeHTTP(invalidResponse, invalidMultipart)
	if invalidResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid multipart status = %d, want 400", invalidResponse.Code)
	}

	for name, test := range map[string]struct {
		kind     model.PhotoTargetKind
		data     []byte
		filename string
	}{
		"unsupported bytes": {kind: model.PhotoTargetDevice, data: []byte("plain text"), filename: "not-photo.txt"},
		"unknown target":    {kind: "unknown", data: testPNG(t), filename: "orphan.png"},
	} {
		t.Run(name, func(t *testing.T) {
			response := performTestPhotoUpload(t, handler, topology, test.kind, topology.Devices[0].ID, test.filename, test.data)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", response.Code, response.Body.String())
			}
		})
	}

	missingPhotoID := "40000000-0000-4000-8000-000000000004"
	missingPhotoPath := "/api/v1/topologies/" + topology.ID + "/photos/" + missingPhotoID
	getMissing := httptest.NewRecorder()
	handler.ServeHTTP(getMissing, httptest.NewRequestWithContext(t.Context(), http.MethodGet, missingPhotoPath, nil))
	if getMissing.Code != http.StatusNotFound {
		t.Fatalf("missing photo GET status = %d, want 404", getMissing.Code)
	}
	missingUpdate := performTestJSONRequest(t, handler, http.MethodPut, missingPhotoPath,
		map[string]string{"originalName": "missing.png", "caption": "missing"})
	if missingUpdate.Code != http.StatusNotFound {
		t.Fatalf("missing photo update status = %d, want 404", missingUpdate.Code)
	}
	missingDelete := performTestJSONRequest(t, handler, http.MethodDelete, missingPhotoPath, nil)
	if missingDelete.Code != http.StatusNotFound {
		t.Fatalf("missing photo delete status = %d, want 404", missingDelete.Code)
	}
}

func newPhotoTestHandler(t *testing.T) (http.Handler, string) {
	t.Helper()
	topologyStore, err := store.NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	mediaDirectory := t.TempDir()
	mediaStore, err := media.Open(mediaDirectory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := mediaStore.Close(); err != nil {
			t.Errorf("closing media store: %v", err)
		}
	})
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	return newHandler(topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static, nil, mediaStore, nil), mediaDirectory
}

func uploadTestPhotos(t *testing.T, handler http.Handler, topology model.Topology, targetKind model.PhotoTargetKind, targetID string, names ...string) model.Topology {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("targetKind", string(targetKind)); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("targetId", targetID); err != nil {
		t.Fatal(err)
	}
	imageData := testPNG(t)
	for _, name := range names {
		part, err := writer.CreateFormFile("photos", name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(imageData); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/photos", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("If-Match", topologyRevisionETag(topology.Revision))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, want 201; body = %s", response.Code, response.Body.String())
	}
	return decodeTopologyResponse(t, response)
}

func performTestPhotoUpload(t *testing.T, handler http.Handler, topology model.Topology, targetKind model.PhotoTargetKind, targetID, name string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("targetKind", string(targetKind)); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("targetId", targetID); err != nil {
		t.Fatal(err)
	}
	part, err := writer.CreateFormFile("photos", name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/photos", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func performTestJSONRequest(t *testing.T, handler http.Handler, method, requestPath string, body any) *httptest.ResponseRecorder {
	t.Helper()
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), method, requestPath, bytes.NewReader(data))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func testPNG(t *testing.T) []byte {
	t.Helper()
	var output bytes.Buffer
	picture := image.NewRGBA(image.Rect(0, 0, 4, 3))
	picture.Set(1, 1, color.RGBA{R: 42, G: 217, B: 200, A: 255})
	if err := png.Encode(&output, picture); err != nil {
		t.Fatal(err)
	}
	return output.Bytes()
}

func decodeTopologyResponse(t *testing.T, response *httptest.ResponseRecorder) model.Topology {
	t.Helper()
	var topology model.Topology
	if err := json.Unmarshal(response.Body.Bytes(), &topology); err != nil {
		t.Fatal(err)
	}
	return topology
}
