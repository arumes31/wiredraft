package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFirstTopologyIDValidatesResponse(t *testing.T) {
	t.Parallel()
	const validID = "6f4cf2f4-3fb1-4c5e-9a0b-6d7c8e9f0a1b"
	for name, test := range map[string]struct {
		status  int
		body    string
		wantErr string
	}{
		"valid":      {http.StatusOK, `[{"id":"` + validID + `"}]`, ""},
		"status":     {http.StatusUnauthorized, `[{"id":"` + validID + `"}]`, "status 401"},
		"empty":      {http.StatusOK, `[]`, "empty"},
		"invalid id": {http.StatusOK, `[{"id":"../events"}]`, "invalid id"},
		"oversized":  {http.StatusOK, `[{"id":"` + strings.Repeat("a", maxTopologyListBytes) + `"}]`, "exceeds"},
	} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(test.status)
			_, _ = w.Write([]byte(test.body))
		}))
		id, err := firstTopologyID(server.Client(), server.URL)
		server.Close()
		if test.wantErr == "" {
			if err != nil || id != validID {
				t.Errorf("%s: firstTopologyID() = %q, %v", name, id, err)
			}
			continue
		}
		if err == nil || !strings.Contains(err.Error(), test.wantErr) {
			t.Errorf("%s: firstTopologyID() error = %v, want %q", name, err, test.wantErr)
		}
	}
}
