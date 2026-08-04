package handler

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLogRequestsUsesMatchedRouteInsteadOfUserPath(t *testing.T) {
	t.Parallel()
	var output bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&output, nil))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /items/{id}", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	handler := logRequests(logger, mux)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/items/line%0Abreak", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	var entry map[string]any
	if err := json.Unmarshal(output.Bytes(), &entry); err != nil {
		t.Fatalf("decoding request log: %v", err)
	}
	if entry["route"] != "GET /items/{id}" {
		t.Fatalf("route = %#v, want matched route pattern", entry["route"])
	}
	if _, logged := entry["path"]; logged {
		t.Fatalf("request log contains user-controlled path: %s", output.String())
	}
}
