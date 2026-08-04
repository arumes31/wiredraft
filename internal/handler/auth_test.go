package handler

import (
	"bytes"
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"

	"netdiagram/internal/auth"
	"netdiagram/internal/model"
	"netdiagram/internal/sse"
	"netdiagram/internal/store"
	webassets "netdiagram/web"
)

const authTestPassword = "a sufficiently long test password"

func TestAuthenticatedGuestWorkspace(t *testing.T) {
	t.Parallel()
	handler, _, topologyStore := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, GuestEnabled: true,
	})
	unauthenticated := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/topologies", nil)
	unauthenticatedResponse := httptest.NewRecorder()
	handler.ServeHTTP(unauthenticatedResponse, unauthenticated)
	if unauthenticatedResponse.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status = %d, want 401", unauthenticatedResponse.Code)
	}

	guestResponse := performJSONRequest(t, handler, http.MethodPost, "/api/v1/auth/guest", map[string]any{}, nil)
	if guestResponse.Code != http.StatusOK {
		t.Fatalf("guest login status = %d, want 200; body = %s", guestResponse.Code, guestResponse.Body.String())
	}
	cookie := guestResponse.Result().Cookies()[0]
	var login struct {
		Session auth.SessionView `json:"session"`
	}
	decodeResponse(t, guestResponse, &login)

	listResponse := performJSONRequest(t, handler, http.MethodGet, "/api/v1/topologies", nil, cookie)
	if listResponse.Code != http.StatusOK {
		t.Fatalf("guest list status = %d, want 200", listResponse.Code)
	}
	var initial []model.Summary
	decodeResponse(t, listResponse, &initial)
	storedSummaries, err := topologyStore.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(initial) != len(storedSummaries) || len(initial) == 0 {
		t.Fatalf("guest summaries = %d, store summaries = %d", len(initial), len(storedSummaries))
	}

	create := newJSONRequest(t, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Guest expansion", "organization": "Private", "location": "Lab", "template": "blank",
	}, cookie)
	create.Header.Set("Origin", "http://example.com")
	create.Header.Set("X-CSRF-Token", login.Session.CSRFToken)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, create)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("guest create status = %d, want 201; body = %s", createResponse.Code, createResponse.Body.String())
	}
	var created model.Topology
	decodeResponse(t, createResponse, &created)
	if created.Organization != "Guest" {
		t.Fatalf("created organization = %q, want Guest", created.Organization)
	}

	createWithoutLocation := newJSONRequest(t, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Guest defaults", "template": "blank",
	}, cookie)
	createWithoutLocation.Header.Set("Origin", "http://example.com")
	createWithoutLocation.Header.Set("X-CSRF-Token", login.Session.CSRFToken)
	defaultResponse := httptest.NewRecorder()
	handler.ServeHTTP(defaultResponse, createWithoutLocation)
	if defaultResponse.Code != http.StatusCreated {
		t.Fatalf("guest default create status = %d, want 201; body = %s", defaultResponse.Code, defaultResponse.Body.String())
	}
	decodeResponse(t, defaultResponse, &created)
	if created.Organization != "Guest" || created.Location != "Guest Workspace" {
		t.Fatalf("guest default scope = %q / %q", created.Organization, created.Location)
	}
}

func TestAdminCSRFAndAccountCreation(t *testing.T) {
	t.Parallel()
	const secret = "JBSWY3DPEHPK3PXP" // #nosec G101 -- public RFC-compatible test fixture.
	handler, _, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
		AdminTOTPSecret: secret, GuestEnabled: true,
	})
	loginResponse := performJSONRequest(t, handler, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"username": "admin", "password": authTestPassword,
	}, nil)
	var challenge auth.LoginChallenge
	decodeResponse(t, loginResponse, &challenge)
	code, err := totp.GenerateCode(secret, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	verifyResponse := performJSONRequest(t, handler, http.MethodPost, "/api/v1/auth/totp", map[string]string{
		"challenge": challenge.Challenge, "code": code,
	}, nil)
	if verifyResponse.Code != http.StatusOK {
		t.Fatalf("totp status = %d, want 200; body = %s", verifyResponse.Code, verifyResponse.Body.String())
	}
	cookie := verifyResponse.Result().Cookies()[0]
	var verified struct {
		Session auth.SessionView `json:"session"`
	}
	decodeResponse(t, verifyResponse, &verified)

	account := map[string]any{ // #nosec G101 -- test-only request credential.
		"username": "vienna-user", "password": "another sufficiently long password",
		"organizations": []string{"Guest"},
	}
	missingCSRF := newJSONRequest(t, http.MethodPost, "/api/v1/admin/users", account, cookie)
	missingCSRF.Header.Set("Origin", "http://example.com")
	missingResponse := httptest.NewRecorder()
	handler.ServeHTTP(missingResponse, missingCSRF)
	if missingResponse.Code != http.StatusForbidden {
		t.Fatalf("missing csrf status = %d, want 403", missingResponse.Code)
	}

	create := newJSONRequest(t, http.MethodPost, "/api/v1/admin/users", account, cookie)
	create.Header.Set("Origin", "http://example.com")
	create.Header.Set("X-CSRF-Token", verified.Session.CSRFToken)
	createdResponse := httptest.NewRecorder()
	handler.ServeHTTP(createdResponse, create)
	if createdResponse.Code != http.StatusCreated {
		t.Fatalf("create account status = %d, want 201; body = %s", createdResponse.Code, createdResponse.Body.String())
	}
	var user auth.UserView
	decodeResponse(t, createdResponse, &user)
	if user.TOTPConfigured || len(user.Organizations) != 1 {
		t.Fatalf("created user = %#v", user)
	}

	statusResponse := performJSONRequest(t, handler, http.MethodGet, "/api/v1/auth/status", nil, cookie)
	var status authStatusResponse
	decodeResponse(t, statusResponse, &status)
	if !status.Authenticated || !status.IsAdmin() || status.CSRFToken != verified.Session.CSRFToken || len(status.AvailableOrganizations) == 0 {
		t.Fatalf("authenticated status = %#v", status)
	}

	usersResponse := performJSONRequest(t, handler, http.MethodGet, "/api/v1/admin/users", nil, cookie)
	if usersResponse.Code != http.StatusOK {
		t.Fatalf("list users status = %d; body = %s", usersResponse.Code, usersResponse.Body.String())
	}
	var usersPayload struct {
		Users         []auth.UserView `json:"users"`
		Organizations []string        `json:"organizations"`
	}
	decodeResponse(t, usersResponse, &usersPayload)
	if len(usersPayload.Users) != 2 || len(usersPayload.Organizations) == 0 {
		t.Fatalf("users payload = %#v", usersPayload)
	}

	update := newJSONRequest(t, http.MethodPut, "/api/v1/admin/users/"+user.ID, updateUserRequest{
		Organizations: []string{"Guest"}, Disabled: true,
	}, cookie)
	update.Header.Set("Origin", "http://example.com")
	update.Header.Set("X-CSRF-Token", verified.Session.CSRFToken)
	updatedResponse := httptest.NewRecorder()
	handler.ServeHTTP(updatedResponse, update)
	if updatedResponse.Code != http.StatusOK {
		t.Fatalf("update account status = %d; body = %s", updatedResponse.Code, updatedResponse.Body.String())
	}
	var updated auth.UserView
	decodeResponse(t, updatedResponse, &updated)
	if !updated.Disabled || len(updated.Organizations) != 1 || updated.Organizations[0] != "Guest" {
		t.Fatalf("updated user = %#v", updated)
	}

	logout := newJSONRequest(t, http.MethodPost, "/api/v1/auth/logout", nil, cookie)
	logout.Header.Set("Origin", "http://example.com")
	logout.Header.Set("X-CSRF-Token", verified.Session.CSRFToken)
	logoutResponse := httptest.NewRecorder()
	handler.ServeHTTP(logoutResponse, logout)
	if logoutResponse.Code != http.StatusNoContent || len(logoutResponse.Result().Cookies()) == 0 || logoutResponse.Result().Cookies()[0].MaxAge != -1 {
		t.Fatalf("logout response = status %d, cookies %#v", logoutResponse.Code, logoutResponse.Result().Cookies())
	}
	statusResponse = performJSONRequest(t, handler, http.MethodGet, "/api/v1/auth/status", nil, cookie)
	decodeResponse(t, statusResponse, &status)
	if status.Authenticated {
		t.Fatal("logged-out session remains authenticated")
	}
	loginPage := performJSONRequest(t, handler, http.MethodGet, "/login", nil, nil)
	if loginPage.Code != http.StatusOK || !bytes.Contains(loginPage.Body.Bytes(), []byte("Secure Access")) {
		t.Fatalf("login page status/body = %d/%q", loginPage.Code, loginPage.Body.String())
	}
}

func TestOrganizationUserOnlySeesAssignedMaps(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	topologyStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	vienna, err := newBlankTopology("Vienna")
	if err != nil {
		t.Fatal(err)
	}
	vienna.Organization = "Vienna Org"
	vienna.Location = "Vienna"
	vienna, err = topologyStore.Create(t.Context(), vienna)
	if err != nil {
		t.Fatal(err)
	}
	berlin, err := newBlankTopology("Berlin")
	if err != nil {
		t.Fatal(err)
	}
	berlin.Organization = "Berlin Org"
	berlin.Location = "Berlin"
	berlin, err = topologyStore.Create(t.Context(), berlin)
	if err != nil {
		t.Fatal(err)
	}
	storedSummaries, err := topologyStore.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	ids := make([]string, 0, len(storedSummaries))
	for _, summary := range storedSummaries {
		ids = append(ids, summary.ID)
	}
	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, GuestEnabled: true,
	}, ids)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := authManager.CreateUser(t.Context(), "vienna-user", "another sufficiently long password", []string{"Vienna Org"}); err != nil {
		t.Fatal(err)
	}
	challenge, err := authManager.StartLogin("vienna-user", "another sufficiently long password", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	code, err := totp.GenerateCode(challenge.Enrollment.ManualCode, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	session, _, err := authManager.CompleteSetup(t.Context(), challenge.Challenge, code)
	if err != nil {
		t.Fatal(err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	handler := NewWithAuth(topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static, authManager)
	cookie := &http.Cookie{Name: sessionCookieName, Value: session.Token} // #nosec G124 -- request fixture, not a response cookie.

	listResponse := performJSONRequest(t, handler, http.MethodGet, "/api/v1/topologies", nil, cookie)
	var summaries []model.Summary
	decodeResponse(t, listResponse, &summaries)
	if len(summaries) != 1 || summaries[0].ID != vienna.ID {
		t.Fatalf("summaries = %#v, want only Vienna", summaries)
	}
	denied := performJSONRequest(t, handler, http.MethodGet, "/api/v1/topologies/"+berlin.ID, nil, cookie)
	if denied.Code != http.StatusNotFound {
		t.Fatalf("cross-organization status = %d, want 404", denied.Code)
	}
}

func TestGuestLoginCanBeDisabled(t *testing.T) {
	t.Parallel()
	handler, _, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, GuestEnabled: false,
	})
	response := performJSONRequest(t, handler, http.MethodPost, "/api/v1/auth/guest", map[string]any{}, nil)
	if response.Code != http.StatusForbidden {
		t.Fatalf("guest login status = %d, want 403", response.Code)
	}
}

func newAuthenticatedTestHandler(t *testing.T, config auth.Config) (http.Handler, *auth.Manager, *store.JSONStore) {
	t.Helper()
	dataDir := t.TempDir()
	topologyStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	storedSummaries, err := topologyStore.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	ids := make([]string, 0, len(storedSummaries))
	for _, summary := range storedSummaries {
		ids = append(ids, summary.ID)
	}
	authManager, err := auth.New(dataDir, config, ids)
	if err != nil {
		t.Fatal(err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	return NewWithAuth(topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static, authManager), authManager, topologyStore
}

func performJSONRequest(t *testing.T, handler http.Handler, method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	request := newJSONRequest(t, method, path, body, cookie)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func newJSONRequest(t *testing.T, method, path string, body any, cookie *http.Cookie) *http.Request {
	t.Helper()
	var data []byte
	var err error
	if body != nil {
		data, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	request := httptest.NewRequestWithContext(t.Context(), method, path, bytes.NewReader(data))
	request.Host = "example.com"
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		request.AddCookie(cookie)
	}
	return request
}

func decodeResponse(t *testing.T, response *httptest.ResponseRecorder, target any) {
	t.Helper()
	if err := json.Unmarshal(response.Body.Bytes(), target); err != nil {
		t.Fatalf("decoding response: %v; body = %s", err, response.Body.String())
	}
}
