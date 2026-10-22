package handler

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"

	"wiredraft/internal/auth"
)

func TestCookieMutationsRequireCSRFTokenWithoutBrowserHeaders(t *testing.T) {
	t.Parallel()
	handler, _, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, GuestEnabled: true,
	})
	guestResponse := performJSONRequest(t, handler, http.MethodPost, "/api/v1/auth/guest", map[string]any{}, nil)
	if guestResponse.Code != http.StatusOK {
		t.Fatalf("guest login status = %d", guestResponse.Code)
	}
	cookie := guestResponse.Result().Cookies()[0]
	var login struct {
		Session auth.SessionView `json:"session"`
	}
	decodeResponse(t, guestResponse, &login)
	body := map[string]string{"name": "CSRF probe", "template": "blank"}

	for _, token := range []string{"", "wrong-token"} {
		request := newJSONRequest(t, http.MethodPost, "/api/v1/topologies", body, cookie)
		request.Header.Del("Origin")
		request.Header.Del("Sec-Fetch-Site")
		if token != "" {
			request.Header.Set("X-CSRF-Token", token)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusForbidden {
			t.Fatalf("headerless mutation with token %q status = %d, want 403", token, response.Code)
		}
	}
	request := newJSONRequest(t, http.MethodPost, "/api/v1/topologies", body, cookie)
	request.Header.Del("Origin")
	request.Header.Del("Sec-Fetch-Site")
	request.Header.Set("X-CSRF-Token", login.Session.CSRFToken)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("mutation with csrf token status = %d, want 201; body = %s", response.Code, response.Body.String())
	}
}

func TestGuestLoginIsRateLimitedPerClient(t *testing.T) {
	t.Parallel()
	guestLogin := func(handler http.Handler, forwardedFor string) int {
		request := newJSONRequest(t, http.MethodPost, "/api/v1/auth/guest", map[string]any{}, nil)
		request.RemoteAddr = "10.0.0.5:44321"
		if forwardedFor != "" {
			request.Header.Set("X-Forwarded-For", forwardedFor)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response.Code
	}

	untrusted, _, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, GuestEnabled: true,
	})
	for attempt := range 10 {
		if status := guestLogin(untrusted, "203.0.113.7"); status != http.StatusOK {
			t.Fatalf("guest login %d status = %d", attempt+1, status)
		}
	}
	// Without a trusted proxy, forwarded headers cannot evade the peer limit.
	if status := guestLogin(untrusted, "198.51.100.99"); status != http.StatusTooManyRequests {
		t.Fatalf("spoofed forwarded guest login status = %d, want 429", status)
	}

	trusted, _, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, GuestEnabled: true,
		TrustedProxies: []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")},
	})
	for attempt := range 10 {
		if status := guestLogin(trusted, "198.51.100.1, 10.0.0.9"); status != http.StatusOK {
			t.Fatalf("proxied guest login %d status = %d", attempt+1, status)
		}
	}
	if status := guestLogin(trusted, "198.51.100.1"); status != http.StatusTooManyRequests {
		t.Fatalf("proxied client over limit status = %d, want 429", status)
	}
	// A client-supplied left-most entry does not change the identified client.
	if status := guestLogin(trusted, "203.0.113.50, 198.51.100.1"); status != http.StatusTooManyRequests {
		t.Fatalf("prepended forwarded entry status = %d, want 429", status)
	}
	if status := guestLogin(trusted, "198.51.100.2"); status != http.StatusOK {
		t.Fatalf("second proxied client status = %d, want 200", status)
	}
}

func TestDocumentationFramesAreHTTPSOnly(t *testing.T) {
	t.Parallel()
	handler, _, _ := newAuthenticatedTestHandler(t, auth.Config{AdminUsername: "admin", AdminPassword: authTestPassword})
	response := performJSONRequest(t, handler, http.MethodGet, "/api/v1/health", nil, nil)
	policy := response.Header().Get("Content-Security-Policy")
	if !strings.Contains(policy, "frame-src https:;") || strings.Contains(policy, "http:;") {
		t.Fatalf("content security policy = %q", policy)
	}
	if strings.Contains(response.Body.String(), "go_version") {
		t.Fatalf("health response exposes the Go version: %s", response.Body.String())
	}
}
