package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"wiredraft/internal/auth"
	"wiredraft/internal/model"
)

func TestRepatchLinkPreservesCableAndPortConfiguration(t *testing.T) {
	t.Parallel()
	for _, endpoint := range []string{"source", "target"} {
		t.Run(endpoint, func(t *testing.T) {
			t.Parallel()
			handler := newTestHandler(t)
			before := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"template": "demo", "name": "Repatch"}, http.StatusCreated)
			link := before.Links[0]
			var destination model.Port
			for _, device := range before.Devices {
				for _, port := range device.Ports {
					occupied := false
					for _, cable := range before.Links {
						occupied = occupied || cable.SourcePortID == port.ID || cable.TargetPortID == port.ID
					}
					if !occupied {
						destination = port
						break
					}
				}
				if destination.ID != "" {
					break
				}
			}
			if destination.ID == "" {
				t.Fatal("fixture has no free port")
			}
			response := repatchRequest(t, handler, before, link.ID, map[string]string{"endpoint": endpoint, "portId": destination.ID}, topologyRevisionETag(before.Revision))
			if response.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			var after model.Topology
			if err := json.Unmarshal(response.Body.Bytes(), &after); err != nil {
				t.Fatal(err)
			}
			oldPort := link.SourcePortID
			if endpoint == "source" {
				before.Links[0].SourcePortID, before.Links[0].SourceDeviceID = destination.ID, destination.DeviceID
			} else {
				oldPort = link.TargetPortID
				before.Links[0].TargetPortID, before.Links[0].TargetDeviceID = destination.ID, destination.DeviceID
			}
			for di := range before.Devices {
				for pi := range before.Devices[di].Ports {
					port := &before.Devices[di].Ports[pi]
					if port.ID == oldPort {
						port.Status = model.PortStatusDown
					}
					if port.ID == destination.ID {
						port.Status = model.PortStatusUp
					}
				}
			}
			before.Revision, before.UpdatedAt = after.Revision, after.UpdatedAt
			if !reflect.DeepEqual(before, after) {
				t.Fatal("repatch changed unrelated data or port configuration")
			}
			stored := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+after.ID, nil, http.StatusOK)
			if !reflect.DeepEqual(stored, after) {
				t.Fatal("repatch was not persisted")
			}
		})
	}
}

func TestRepatchLinkSwapsOnlyConfirmedEnds(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	before := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"template": "demo", "name": "Swap"}, http.StatusCreated)
	before = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+before.ID+"/link-groups", model.LinkGroup{Name: "Preserved", Mode: model.LinkGroupModeLACP, LinkIDs: []string{before.Links[0].ID, before.Links[1].ID}}, http.StatusCreated)
	a, b := before.Links[0], before.Links[1]
	response := repatchRequest(t, handler, before, a.ID, map[string]string{"endpoint": "source", "portId": b.SourcePortID, "swapLinkId": b.ID}, topologyRevisionETag(before.Revision))
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var after model.Topology
	if err := json.Unmarshal(response.Body.Bytes(), &after); err != nil {
		t.Fatal(err)
	}
	before.Links[0].SourceDeviceID, before.Links[0].SourcePortID = b.SourceDeviceID, b.SourcePortID
	before.Links[1].SourceDeviceID, before.Links[1].SourcePortID = a.SourceDeviceID, a.SourcePortID
	if after.Revision != before.Revision+1 {
		t.Fatal("swap must use exactly one revision")
	}
	before.Revision, before.UpdatedAt = after.Revision, after.UpdatedAt
	if !reflect.DeepEqual(before, after) {
		t.Fatal("swap changed cable properties, groups or port configuration")
	}
}

func TestRepatchLinkRejectsWithoutPartialChanges(t *testing.T) {
	t.Parallel()
	for _, name := range []string{"unconfirmed swap", "wrong cable", "same cable", "missing port", "invalid end", "missing revision", "stale revision", "unknown field"} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			handler := newTestHandler(t)
			before := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"template": "demo", "name": name}, http.StatusCreated)
			a, b := before.Links[0], before.Links[1]
			input := map[string]string{"endpoint": "source", "portId": b.SourcePortID, "swapLinkId": b.ID}
			revision := topologyRevisionETag(before.Revision)
			status := http.StatusBadRequest
			switch name {
			case "unconfirmed swap":
				delete(input, "swapLinkId")
			case "wrong cable":
				input["swapLinkId"] = "another-cable"
			case "same cable":
				input["portId"], input["swapLinkId"] = a.TargetPortID, a.ID
			case "missing port":
				input["portId"] = "absent"
			case "invalid end":
				input["endpoint"] = "both"
			case "missing revision":
				revision = ""
			case "stale revision":
				revision, status = "\"rev-999999\"", http.StatusConflict
			case "unknown field":
				input["nativeVlan"] = "20"
			}
			response := repatchRequest(t, handler, before, a.ID, input, revision)
			if response.Code != status {
				t.Fatalf("status=%d want=%d body=%s", response.Code, status, response.Body.String())
			}
			after := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+before.ID, nil, http.StatusOK)
			if !reflect.DeepEqual(before, after) {
				t.Fatal("rejected repatch changed stored topology")
			}
		})
	}
}

func TestRepatchRearPlanesPreserveFrontCable(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	before := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"template": "blank", "name": "Rear plane"}, http.StatusCreated)
	path := "/api/v1/topologies/" + before.ID
	for _, name := range []string{"Panel A", "Panel B"} {
		before = requestTopology(t, handler, http.MethodPost, path+"/devices", testPatchPanel(name, 3), http.StatusCreated)
	}
	a, b := before.Devices[0], before.Devices[1]
	for _, cable := range []struct {
		index int
		side  model.LinkEndpointSide
	}{
		{0, model.LinkEndpointSideRear}, {1, model.LinkEndpointSideRear}, {1, model.LinkEndpointSideFront},
	} {
		before = requestTopology(t, handler, http.MethodPost, path+"/links", model.Link{
			SourceDeviceID: a.ID, SourcePortID: a.Ports[cable.index].ID, SourceSide: cable.side,
			TargetDeviceID: b.ID, TargetPortID: b.Ports[cable.index].ID, TargetSide: cable.side, CableType: "CAT6A",
		}, http.StatusCreated)
	}
	response := repatchRequest(t, handler, before, before.Links[0].ID, map[string]string{
		"endpoint": "source", "portId": a.Ports[1].ID, "swapLinkId": before.Links[1].ID,
	}, topologyRevisionETag(before.Revision))
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	after := requestTopology(t, handler, http.MethodGet, path, nil, http.StatusOK)
	before.Links[0].SourcePortID, before.Links[1].SourcePortID = a.Ports[1].ID, a.Ports[0].ID
	before.Revision, before.UpdatedAt = after.Revision, after.UpdatedAt
	if !reflect.DeepEqual(before, after) {
		t.Fatal("rear swap modified front cable, ports or cable metadata")
	}
	response = repatchRequest(t, handler, after, after.Links[0].ID, map[string]string{
		"endpoint": "source", "portId": a.Ports[2].ID,
	}, topologyRevisionETag(after.Revision))
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	after = requestTopology(t, handler, http.MethodGet, path, nil, http.StatusOK)
	before.Links[0].SourcePortID = a.Ports[2].ID
	before.Revision, before.UpdatedAt = after.Revision, after.UpdatedAt
	if !reflect.DeepEqual(before, after) {
		t.Fatal("rear move modified front cable or port state")
	}
}

func TestRepatchLinkRollsBackInvalidGroup(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	before := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"template": "demo", "name": "Invalid group"}, http.StatusCreated)
	path := "/api/v1/topologies/" + before.ID
	before = requestTopology(t, handler, http.MethodPost, path+"/link-groups", model.LinkGroup{
		Name: "Ethernet", Mode: model.LinkGroupModeLACP, LinkIDs: []string{before.Links[0].ID, before.Links[1].ID},
	}, http.StatusCreated)
	// A free power socket is a valid port, but cannot become an Ethernet group member.
	panel := testPatchPanel("Power test", 1)
	panel.Category = model.DeviceCategoryServer
	panel.Ports[0].Type = model.PortTypePower
	before = requestTopology(t, handler, http.MethodPost, path+"/devices", panel, http.StatusCreated)
	portID := before.Devices[len(before.Devices)-1].Ports[0].ID
	response := repatchRequest(t, handler, before, before.Links[0].ID, map[string]string{"endpoint": "target", "portId": portID}, topologyRevisionETag(before.Revision))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	after := requestTopology(t, handler, http.MethodGet, path, nil, http.StatusOK)
	if !reflect.DeepEqual(before, after) {
		t.Fatal("failed final validation changed endpoints or port statuses")
	}
}

func TestRepatchLinkRequiresAuthentication(t *testing.T) {
	t.Parallel()
	handler, _, _ := newAuthenticatedTestHandler(t, auth.Config{AdminUsername: "admin", AdminPassword: authTestPassword})
	response := repatchRequest(t, handler, model.Topology{ID: "hidden"}, "hidden", map[string]string{"endpoint": "source", "portId": "hidden"}, "\"rev-1\"")
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated repatch status=%d", response.Code)
	}
}

func repatchRequest(t *testing.T, handler http.Handler, topology model.Topology, linkID string, input map[string]string, revision string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPut, "/api/v1/topologies/"+topology.ID+"/links/"+linkID+"/endpoint", bytes.NewReader(body))
	request.Header.Set("If-Match", revision)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}
