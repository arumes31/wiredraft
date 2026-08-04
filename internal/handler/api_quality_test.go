package handler

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"netdiagram/internal/model"
)

//go:embed testdata/snapshots/v1-api-contract.json
var contractSnapshots embed.FS

func TestAPIIntegrationLifecycle(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	created := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "API integration", "template": "blank",
	}, http.StatusCreated)
	if created.Name != "API integration" {
		t.Fatalf("created name = %q", created.Name)
	}

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/topologies", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("list status = %d", response.Code)
	}
	var summaries []map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &summaries); err != nil {
		t.Fatal(err)
	}
	if !slices.ContainsFunc(summaries, func(summary map[string]any) bool { return summary["id"] == created.ID }) {
		t.Fatalf("created topology %q missing from list response", created.ID)
	}

	created = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+created.ID+"/vlans", map[string]any{
		"id": 100, "name": "Users", "colorHex": "#336699", "description": "integration",
	}, http.StatusCreated)
	if !slices.ContainsFunc(created.VLANs, func(vlan model.VLAN) bool { return vlan.ID == 100 && vlan.Name == "Users" }) {
		t.Fatalf("VLAN response = %#v", created.VLANs)
	}

	request = httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/topologies/"+created.ID+"/analysis", nil)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !json.Valid(response.Body.Bytes()) {
		t.Fatalf("analysis status/body = %d %q", response.Code, response.Body.String())
	}
}

func TestTopologyReplacementVLANLifecycleAndTrace(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Lifecycle", "template": "demo",
	}, http.StatusCreated)
	topology.Name = "Lifecycle updated"
	topology = requestTopology(t, handler, http.MethodPut, "/api/v1/topologies/"+topology.ID, topology, http.StatusOK)
	if topology.Name != "Lifecycle updated" {
		t.Fatalf("replacement topology name = %q", topology.Name)
	}

	vlansPath := "/api/v1/topologies/" + topology.ID + "/vlans"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodGet, vlansPath, nil))
	var vlans []model.VLAN
	if err := json.Unmarshal(response.Body.Bytes(), &vlans); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusOK || len(vlans) < 2 {
		t.Fatalf("VLAN list status/count = %d/%d", response.Code, len(vlans))
	}
	vlanIndex := slices.IndexFunc(vlans, func(vlan model.VLAN) bool { return vlan.ID == 20 })
	if vlanIndex < 0 {
		t.Fatal("demo topology is missing VLAN 20")
	}
	vlans[vlanIndex].Name = "Users updated"
	topology = requestTopology(t, handler, http.MethodPut, vlansPath+"/20", vlans[vlanIndex], http.StatusOK)
	if !slices.ContainsFunc(topology.VLANs, func(vlan model.VLAN) bool { return vlan.ID == 20 && vlan.Name == "Users updated" }) {
		t.Fatalf("updated VLANs = %#v", topology.VLANs)
	}

	tracePath := fmt.Sprintf(
		"/api/v1/topologies/%s/trace?source=%s&target=%s&vlan=%d",
		topology.ID,
		topology.Devices[0].Ports[0].ID,
		topology.Devices[3].Ports[0].ID,
		1,
	)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodGet, tracePath, nil))
	if response.Code != http.StatusOK {
		t.Fatalf("trace status = %d; body = %s", response.Code, response.Body.String())
	}

	topology = requestTopology(t, handler, http.MethodDelete, vlansPath+"/20", nil, http.StatusOK)
	if slices.ContainsFunc(topology.VLANs, func(vlan model.VLAN) bool { return vlan.ID == 20 }) {
		t.Fatal("VLAN 20 was not deleted")
	}
	for _, device := range topology.Devices {
		for _, port := range device.Ports {
			if port.NativeVLAN == 20 || slices.Contains(port.AllowedVLANs, 20) {
				t.Fatalf("port %q retains deleted VLAN 20: %#v", port.ID, port)
			}
		}
	}
	for _, current := range topology.Links {
		if current.PrimaryVLAN == 20 || slices.Contains(current.VLANIDs, 20) {
			t.Fatalf("link %q retains deleted VLAN 20: %#v", current.ID, current)
		}
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodDelete, vlansPath+"/1", nil))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("delete VLAN 1 status = %d, want 400", response.Code)
	}
}

func TestV1APIResponseContractSnapshot(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	actual := map[string]any{}
	for name, path := range map[string]string{
		"health": "/api/v1/health",
		"list":   "/api/v1/topologies",
		"error":  "/api/v1/topologies/00000000-0000-4000-8000-000000000000",
	} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil))
		var decoded any
		if err := json.Unmarshal(response.Body.Bytes(), &decoded); err != nil {
			t.Fatalf("decode %s: %v", name, err)
		}
		actual[name] = responseContract(decoded)
	}

	encoded, err := json.MarshalIndent(actual, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	encoded = append(encoded, '\n')
	const snapshotPath = "testdata/snapshots/v1-api-contract.json"
	if os.Getenv("UPDATE_SNAPSHOTS") == "1" {
		path := filepath.FromSlash(snapshotPath)
		if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, encoded, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	want, err := contractSnapshots.ReadFile(snapshotPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(encoded, want) {
		t.Fatalf("v1 API contract changed; inspect compatibility or run UPDATE_SNAPSHOTS=1 go test ./internal/handler\nwant:\n%s\ngot:\n%s", want, encoded)
	}
}

func responseContract(value any) any {
	switch typed := value.(type) {
	case []any:
		if len(typed) == 0 {
			return []any{}
		}
		return []any{responseContract(typed[0])}
	case map[string]any:
		result := make(map[string]any, len(typed))
		for key, nested := range typed {
			switch key {
			case "id", "updatedAt", "createdAt", "go_version":
				result[key] = "$dynamic"
			default:
				result[key] = responseContract(nested)
			}
		}
		return result
	default:
		return value
	}
}
