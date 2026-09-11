package handler

import (
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"wiredraft/internal/auth"
	"wiredraft/internal/model"
	"wiredraft/internal/sse"
	"wiredraft/internal/store"
	webassets "wiredraft/web"
)

// TestUpdateLinkMediaPreservesTopology proves that physical media edits cannot synchronize endpoint or group configuration.
func TestUpdateLinkMediaPreservesTopology(t *testing.T) {
	t.Parallel()
	topologyStore, err := store.NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	broker := sse.NewBroker()
	t.Cleanup(broker.Close)
	handler := New(topologyStore, broker, slog.New(slog.DiscardHandler), static)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"name": "Media only", "template": "demo"}, http.StatusCreated)
	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/link-groups", model.LinkGroup{
		Name: "Preserved group", Mode: model.LinkGroupModeLACP, LinkIDs: []string{topology.Links[0].ID, topology.Links[1].ID},
	}, http.StatusCreated)
	path := "/api/v1/topologies/" + topology.ID + "/links/" + topology.Links[0].ID + "/media"
	events, cancel := broker.Subscribe(topology.ID)
	defer cancel()
	for _, cableType := range []string{"SAS", "FC", "Power", strings.Repeat("x", 80)} {
		request := httptest.NewRequestWithContext(t.Context(), http.MethodPut, path, strings.NewReader(`{"cableType":"  `+cableType+`  "}`))
		request.Header.Set("If-Match", topologyRevisionETag(topology.Revision))
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("media update status=%d body=%s", response.Code, response.Body.String())
		}
		var updated model.Topology
		if err := json.Unmarshal(response.Body.Bytes(), &updated); err != nil {
			t.Fatal(err)
		}
		select {
		case event := <-events:
			if event.Type != "link_configured" {
				t.Fatalf("event type=%q want existing link_configured refresh", event.Type)
			}
			var eventTopology model.Topology
			if err := json.Unmarshal(event.Data, &eventTopology); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(eventTopology, updated) {
				t.Fatal("collaboration event differs from returned persisted topology")
			}
		default:
			t.Fatal("media update did not publish a collaboration refresh")
		}
		if updated.Revision != topology.Revision+1 {
			t.Fatalf("revision=%d want%d", updated.Revision, topology.Revision+1)
		}
		topology.Links[0].CableType = cableType
		topology.Revision, topology.UpdatedAt = updated.Revision, updated.UpdatedAt
		if !reflect.DeepEqual(updated, topology) {
			t.Fatal("media update changed data beyond selected CableType, revision and update time")
		}
		stored := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil, http.StatusOK)
		if !reflect.DeepEqual(stored, updated) {
			t.Fatal("returned media update differs from atomic persisted topology")
		}
	}
}

// TestUpdateLinkMediaWithPhysicalPorts preserves non-Ethernet endpoint records through the persisted API.
func TestUpdateLinkMediaWithPhysicalPorts(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name     string
		portType model.PortType
		speed    int
	}{
		{name: "SAS", portType: model.PortTypeSASMiniHD12G, speed: 12000},
		{name: "FC", portType: model.PortTypeFCSFP16G, speed: 16000},
		{name: "Power", portType: model.PortTypePower, speed: 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			handler := newTestHandler(t)
			topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"name": tc.name, "template": "demo"}, http.StatusCreated)
			selected := topology.Links[0]
			for di := range topology.Devices {
				for pi := range topology.Devices[di].Ports {
					port := &topology.Devices[di].Ports[pi]
					if port.ID == selected.SourcePortID || port.ID == selected.TargetPortID {
						port.Type, port.SpeedMbps = tc.portType, tc.speed
					}
				}
			}
			topology = requestTopology(t, handler, http.MethodPut, "/api/v1/topologies/"+topology.ID, topology, http.StatusOK)
			updated := requestTopology(t, handler, http.MethodPut, "/api/v1/topologies/"+topology.ID+"/links/"+selected.ID+"/media", map[string]string{"cableType": tc.name}, http.StatusOK)
			topology.Links[0].CableType = tc.name
			topology.Revision, topology.UpdatedAt = updated.Revision, updated.UpdatedAt
			if !reflect.DeepEqual(topology, updated) {
				t.Fatal("physical cable media update rewrote endpoint or unrelated topology records")
			}
		})
	}
}

// TestUpdateLinkMediaRejectsInvalidRequests verifies strict input and failed-write atomicity through the real router.
func TestUpdateLinkMediaRejectsInvalidRequests(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name, body, linkID, revision string
		status                       int
	}{
		{name: "missing", body: `{}`, status: http.StatusBadRequest},
		{name: "null", body: `null`, status: http.StatusBadRequest},
		{name: "null field", body: `{"cableType":null}`, status: http.StatusBadRequest},
		{name: "empty", body: `{"cableType":" \t "}`, status: http.StatusBadRequest},
		{name: "long", body: `{"cableType":"` + strings.Repeat("x", 81) + `"}`, status: http.StatusBadRequest},
		{name: "wrong type", body: `{"cableType":10}`, status: http.StatusBadRequest},
		{name: "endpoint rewrite", body: `{"cableType":"SAS","mode":"access"}`, status: http.StatusBadRequest},
		{name: "multiple values", body: `{"cableType":"SAS"}{}`, status: http.StatusBadRequest},
		{name: "malformed", body: `{`, status: http.StatusBadRequest},
		{name: "unknown link", body: `{"cableType":"SAS"}`, linkID: "absent", status: http.StatusNotFound},
		{name: "stale revision", body: `{"cableType":"SAS"}`, revision: `"rev-999999"`, status: http.StatusConflict},
		{name: "invalid revision", body: `{"cableType":"SAS"}`, revision: "invalid", status: http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			handler := newTestHandler(t)
			before := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"name": "Rejected media", "template": "demo"}, http.StatusCreated)
			linkID := tc.linkID
			if linkID == "" {
				linkID = before.Links[0].ID
			}
			request := httptest.NewRequestWithContext(t.Context(), http.MethodPut, "/api/v1/topologies/"+before.ID+"/links/"+linkID+"/media", strings.NewReader(tc.body))
			request.Header.Set("If-Match", tc.revision)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("status=%d want%d body=%s", response.Code, tc.status, response.Body.String())
			}
			after := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+before.ID, nil, http.StatusOK)
			if !reflect.DeepEqual(before, after) {
				t.Fatal("rejected request changed persisted topology")
			}
		})
	}
}

// TestUpdateLinkMediaRequiresAuthentication proves the new path uses the protected topology registrar.
func TestUpdateLinkMediaRequiresAuthentication(t *testing.T) {
	t.Parallel()
	handler, _, _ := newAuthenticatedTestHandler(t, auth.Config{AdminUsername: "admin", AdminPassword: authTestPassword})
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPut, "/api/v1/topologies/hidden/links/hidden/media", strings.NewReader(`{"cableType":"Power"}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated media update status=%d want401", response.Code)
	}
}
