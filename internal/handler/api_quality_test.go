package handler

import (
	"bytes"
	"embed"
	"encoding/json"
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
