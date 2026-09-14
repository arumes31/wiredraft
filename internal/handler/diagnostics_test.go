package handler

import (
	"net/http"
	"testing"

	"wiredraft/internal/auth"
)

func TestDiagnosticsOnlyReturnsBuildFields(t *testing.T) {
	t.Parallel()
	response := performTestJSONRequest(t, newTestHandler(t), http.MethodGet, "/api/v1/diagnostics", nil)
	if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("diagnostics response = %d %s", response.Code, response.Body.String())
	}
	var result map[string]string
	decodeResponse(t, response, &result)
	if len(result) != 4 || result["application"] != "WireDraft" || result["revision"] == "" || result["goVersion"] == "" {
		t.Fatalf("unexpected diagnostics fields: %#v", result)
	}
}

func TestDiagnosticsRequiresAuthentication(t *testing.T) {
	t.Parallel()
	handler, _, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	response := performTestJSONRequest(t, handler, http.MethodGet, "/api/v1/diagnostics", nil)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated diagnostics status = %d", response.Code)
	}
}
