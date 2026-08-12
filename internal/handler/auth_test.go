package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"

	"wiredraft/internal/auth"
	"wiredraft/internal/media"
	"wiredraft/internal/model"
	"wiredraft/internal/sse"
	"wiredraft/internal/store"
	webassets "wiredraft/web"
)

const authTestPassword = "a sufficiently long test password"

func TestAuthenticatedGuestWorkspace(t *testing.T) {
	t.Parallel()
	handler, authManager, topologyStore := newAuthenticatedTestHandler(t, auth.Config{
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
	if len(initial) != 0 || len(storedSummaries) == 0 {
		t.Fatalf("initial guest summaries = %#v, store summaries = %d", initial, len(storedSummaries))
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
	if created.Organization != "Guest" || created.OrganizationID != authManager.GuestOrganizationID() {
		t.Fatalf("created organization = %q (%q), want stable Guest organization", created.Organization, created.OrganizationID)
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
	listResponse = performJSONRequest(t, handler, http.MethodGet, "/api/v1/topologies", nil, cookie)
	var guestMaps []model.Summary
	decodeResponse(t, listResponse, &guestMaps)
	if len(guestMaps) != 2 {
		t.Fatalf("guest summaries after create = %#v, want two Guest-owned maps", guestMaps)
	}
	for _, summary := range guestMaps {
		if summary.OrganizationID != authManager.GuestOrganizationID() {
			t.Fatalf("guest response exposed organization %q", summary.OrganizationID)
		}
	}
}

func TestAdminCSRFAndAccountCreation(t *testing.T) {
	t.Parallel()
	const secret = "JBSWY3DPEHPK3PXP" // #nosec G101 -- public RFC-compatible test fixture.
	const adminUsername = "audit-operator"
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	handler, _, topologyStore := newAuthenticatedTestHandlerWithLogger(t, auth.Config{
		AdminUsername: adminUsername, AdminPassword: authTestPassword,
		AdminTOTPSecret: secret, GuestEnabled: true,
	}, logger)
	loginResponse := performJSONRequest(t, handler, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"username": adminUsername, "password": authTestPassword,
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

	guest := testOrganization(t, topologyStore, auth.GuestOrganizationName)
	account := map[string]any{ // #nosec G101 -- test-only request credential.
		"username": "vienna-user", "password": "another sufficiently long password",
		"role": auth.RoleUser, "allOrganizations": false, "organizationIds": []string{guest.ID},
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
	if user.TOTPConfigured || len(user.OrganizationIDs) != 1 {
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
		Users         []auth.UserView      `json:"users"`
		Organizations []store.Organization `json:"organizations"`
	}
	decodeResponse(t, usersResponse, &usersPayload)
	if len(usersPayload.Users) != 2 || len(usersPayload.Organizations) == 0 {
		t.Fatalf("users payload = %#v", usersPayload)
	}

	update := newJSONRequest(t, http.MethodPut, "/api/v1/admin/users/"+user.ID, updateUserRequest{
		UserUpdate: auth.UserUpdate{Access: auth.Access{
			Role: auth.RoleUser, OrganizationIDs: []string{guest.ID},
		}, Disabled: true},
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
	if !updated.Disabled || len(updated.OrganizationIDs) != 1 || updated.OrganizationIDs[0] != guest.ID {
		t.Fatalf("updated user = %#v", updated)
	}
	logOutput := logs.String()
	for _, event := range []string{"authentication succeeded", "account created", "account updated"} {
		if !strings.Contains(logOutput, `"msg":"`+event+`"`) {
			t.Errorf("audit log is missing %q event", event)
		}
	}
	for _, userValue := range []string{adminUsername, "vienna-user", `"organizations"`, `"administrator"`, `"user"`} {
		if strings.Contains(logOutput, userValue) {
			t.Errorf("audit log contains user-controlled identity field %q: %s", userValue, logOutput)
		}
	}
	updateEntryFound := false
	for line := range strings.SplitSeq(strings.TrimSpace(logOutput), "\n") {
		var entry map[string]any
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			t.Fatalf("decoding audit log entry: %v", err)
		}
		if entry["msg"] != "account updated" {
			continue
		}
		updateEntryFound = true
		for _, field := range []string{"user_id", "disabled", "organization_count"} {
			if _, exists := entry[field]; exists {
				t.Errorf("account update audit log contains request-derived field %q: %s", field, line)
			}
		}
	}
	if !updateEntryFound {
		t.Error("account update audit log entry was not found")
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
	viennaOrganization := createTestOrganization(t, topologyStore, "Vienna Org")
	berlinOrganization := createTestOrganization(t, topologyStore, "Berlin Org")
	createTestOrganization(t, topologyStore, auth.GuestOrganizationName)
	vienna, err := newBlankTopology("Vienna")
	if err != nil {
		t.Fatal(err)
	}
	vienna.OrganizationID = viennaOrganization.ID
	vienna.Organization = viennaOrganization.Name
	vienna.Location = "Vienna"
	vienna, err = topologyStore.Create(t.Context(), vienna)
	if err != nil {
		t.Fatal(err)
	}
	berlin, err := newBlankTopology("Berlin")
	if err != nil {
		t.Fatal(err)
	}
	berlin.OrganizationID = berlinOrganization.ID
	berlin.Organization = berlinOrganization.Name
	berlin.Location = "Berlin"
	berlin, err = topologyStore.Create(t.Context(), berlin)
	if err != nil {
		t.Fatal(err)
	}
	photoID, err := model.NewID()
	if err != nil {
		t.Fatal(err)
	}
	berlin, err = topologyStore.Mutate(t.Context(), berlin.ID, func(topology *model.Topology) error {
		topology.Photos = append(topology.Photos, model.Photo{
			ID: photoID, TargetKind: model.PhotoTargetTopology, TargetID: topology.ID,
			OriginalName: "berlin-private.png", MediaType: "image/png", SizeBytes: 128, CreatedAt: time.Now().UTC(),
		})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, GuestEnabled: true,
	}, testOrganizationRefs(t, topologyStore))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := authManager.CreateUser(t.Context(), "vienna-user", "another sufficiently long password", auth.Access{
		Role: auth.RoleUser, OrganizationIDs: []string{viennaOrganization.ID},
	}); err != nil {
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
	mediaStore, err := media.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = mediaStore.Close() })
	handler := NewWithAuthAndMedia(topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static, authManager, mediaStore)
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
	deniedPhoto := performJSONRequest(t, handler, http.MethodGet,
		"/api/v1/topologies/"+berlin.ID+"/photos/"+photoID, nil, cookie)
	if deniedPhoto.Code != http.StatusNotFound {
		t.Fatalf("cross-organization photo status = %d, want 404", deniedPhoto.Code)
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

type fakeEntraAuthenticator struct {
	start       auth.EntraStart
	identity    auth.ExternalIdentity
	beginErr    error
	completeErr error
	state       string
	flow        string
	code        string
}

func (f *fakeEntraAuthenticator) Begin(context.Context) (auth.EntraStart, error) {
	return f.start, f.beginErr
}

func (f *fakeEntraAuthenticator) Complete(_ context.Context, state, flow, code string) (auth.ExternalIdentity, error) {
	f.state, f.flow, f.code = state, flow, code
	return f.identity, f.completeErr
}

func TestEntraLoginCreatesNormalWireDraftSession(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	topologyStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, CookieSecure: true,
	}, testOrganizationRefs(t, topologyStore))
	if err != nil {
		t.Fatal(err)
	}
	defaultOrganization := testOrganization(t, topologyStore, model.DefaultOrganizationName)
	user, err := authManager.CreateEntraUser(t.Context(), "Microsoft Operator", "operator@example.com", auth.Access{
		Role: auth.RoleUser, OrganizationIDs: []string{defaultOrganization.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	entra := &fakeEntraAuthenticator{
		start: auth.EntraStart{
			AuthorizationURL: "https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize",
			FlowToken:        "browser-binding", ExpiresAt: time.Now().Add(5 * time.Minute),
		},
		identity: auth.ExternalIdentity{
			TenantID: "tenant", ObjectID: "object", PreferredUsername: "operator@example.com",
		},
	}
	handler := newHandler(topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static, authManager, nil, entra)

	statusResponse := performJSONRequest(t, handler, http.MethodGet, "/api/v1/auth/status", nil, nil)
	var status authStatusResponse
	decodeResponse(t, statusResponse, &status)
	if !status.EntraEnabled {
		t.Fatal("auth status did not advertise Entra login")
	}

	startRequest := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/auth/entra/start", nil)
	startRequest.Host = "example.com"
	startResponse := httptest.NewRecorder()
	handler.ServeHTTP(startResponse, startRequest)
	if startResponse.Code != http.StatusSeeOther || startResponse.Header().Get("Location") != entra.start.AuthorizationURL {
		t.Fatalf("Entra start = %d %q", startResponse.Code, startResponse.Header().Get("Location"))
	}
	var flowCookie *http.Cookie
	for _, cookie := range startResponse.Result().Cookies() {
		if cookie.Name == entraFlowCookieName {
			flowCookie = cookie
		}
	}
	if flowCookie == nil || !flowCookie.Secure || flowCookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("flow cookie = %#v", flowCookie)
	}

	callbackRequest := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/auth/entra/callback?state=state-value&code=code-value", nil)
	callbackRequest.AddCookie(flowCookie)
	callbackResponse := httptest.NewRecorder()
	handler.ServeHTTP(callbackResponse, callbackRequest)
	if callbackResponse.Code != http.StatusSeeOther || callbackResponse.Header().Get("Location") != "/" {
		t.Fatalf("Entra callback = %d %q", callbackResponse.Code, callbackResponse.Header().Get("Location"))
	}
	if entra.state != "state-value" || entra.flow != "browser-binding" || entra.code != "code-value" {
		t.Fatalf("completed flow = %q %q %q", entra.state, entra.flow, entra.code)
	}
	var sessionCookie *http.Cookie
	for _, cookie := range callbackResponse.Result().Cookies() {
		if cookie.Name == sessionCookieName {
			sessionCookie = cookie
		}
	}
	if sessionCookie == nil || !sessionCookie.Secure {
		t.Fatalf("session cookie = %#v", sessionCookie)
	}
	session, exists := authManager.Session(sessionCookie.Value)
	if !exists || session.Principal.UserID != user.ID {
		t.Fatalf("session = %#v, exists = %v", session, exists)
	}
}

func TestNilEntraProviderRemainsDisabled(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	topologyStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	}, testOrganizationRefs(t, topologyStore))
	if err != nil {
		t.Fatal(err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	handler := NewWithAuthMediaAndEntra(
		topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static, authManager, nil, nil,
	)
	statusResponse := performJSONRequest(t, handler, http.MethodGet, "/api/v1/auth/status", nil, nil)
	var status authStatusResponse
	decodeResponse(t, statusResponse, &status)
	if status.EntraEnabled {
		t.Fatal("nil Entra provider was advertised as enabled")
	}
	startRequest := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/auth/entra/start", nil)
	startResponse := httptest.NewRecorder()
	handler.ServeHTTP(startResponse, startRequest)
	if startResponse.Code != http.StatusSeeOther || startResponse.Header().Get("Location") != "/login" {
		t.Fatalf(
			"disabled Entra start = %d %q, want login redirect",
			startResponse.Code, startResponse.Header().Get("Location"),
		)
	}
}

func TestEntraFailuresUseGenericBrowserErrors(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	topologyStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, CookieSecure: true,
	}, testOrganizationRefs(t, topologyStore))
	if err != nil {
		t.Fatal(err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	entra := &fakeEntraAuthenticator{beginErr: auth.ErrExternalUnavailable}
	handler := newHandler(
		topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static, authManager, nil, entra,
	)

	startRequest := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/auth/entra/start", nil)
	startRequest.Host = "example.com"
	startResponse := httptest.NewRecorder()
	handler.ServeHTTP(startResponse, startRequest)
	if startResponse.Code != http.StatusSeeOther || startResponse.Header().Get("Location") != "/login?entra_error=unavailable" {
		t.Fatalf("unavailable start = %d %q", startResponse.Code, startResponse.Header().Get("Location"))
	}

	missingCookie := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet, "/api/v1/auth/entra/callback?state=state&code=code", nil,
	)
	missingCookieResponse := httptest.NewRecorder()
	handler.ServeHTTP(missingCookieResponse, missingCookie)
	if missingCookieResponse.Header().Get("Location") != "/login?entra_error=rejected" {
		t.Fatalf("missing-cookie callback location = %q", missingCookieResponse.Header().Get("Location"))
	}

	entra.beginErr = nil
	entra.completeErr = auth.ErrExternalUnavailable
	unavailable := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet, "/api/v1/auth/entra/callback?state=state&code=code", nil,
	)
	unavailable.AddCookie(&http.Cookie{
		Name: entraFlowCookieName, Value: "flow", Path: "/api/v1/auth/entra/",
		Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	unavailableResponse := httptest.NewRecorder()
	handler.ServeHTTP(unavailableResponse, unavailable)
	if unavailableResponse.Header().Get("Location") != "/login?entra_error=unavailable" {
		t.Fatalf("unavailable callback location = %q", unavailableResponse.Header().Get("Location"))
	}

	entra.completeErr = nil
	entra.identity = auth.ExternalIdentity{
		TenantID: "tenant", ObjectID: "unknown-object", PreferredUsername: "unknown@example.com",
	}
	rejected := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet, "/api/v1/auth/entra/callback?state=state&code=code", nil,
	)
	rejected.AddCookie(&http.Cookie{
		Name: entraFlowCookieName, Value: "flow", Path: "/api/v1/auth/entra/",
		Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	rejectedResponse := httptest.NewRecorder()
	handler.ServeHTTP(rejectedResponse, rejected)
	if rejectedResponse.Header().Get("Location") != "/login?entra_error=rejected" {
		t.Fatalf("unknown-account callback location = %q", rejectedResponse.Header().Get("Location"))
	}
}

func TestAdminCreatesAndResetsEntraAccount(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	topologyStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	guest := createTestOrganization(t, topologyStore, auth.GuestOrganizationName)
	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, CookieSecure: true, GuestEnabled: true,
	}, testOrganizationRefs(t, topologyStore))
	if err != nil {
		t.Fatal(err)
	}
	server := &Server{
		store: topologyStore, auth: authManager, entra: &fakeEntraAuthenticator{},
		logger: slog.New(slog.DiscardHandler),
	}
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	adminCookie := &http.Cookie{Name: sessionCookieName, Value: adminSession.Token} // #nosec G124 -- request fixture.
	create := newJSONRequest(t, http.MethodPost, "/api/v1/admin/users", createUserRequest{
		Access:   auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{guest.ID}},
		Username: "Entra Operator", AuthSource: auth.AuthSourceEntra,
		ExternalLogin: "operator@example.com",
	}, nil)
	create.AddCookie(adminCookie)
	createdResponse := httptest.NewRecorder()
	server.createUser(createdResponse, create)
	if createdResponse.Code != http.StatusCreated {
		t.Fatalf("create Entra account status = %d; body = %s", createdResponse.Code, createdResponse.Body.String())
	}
	var created auth.UserView
	decodeResponse(t, createdResponse, &created)
	if created.AuthSource != auth.AuthSourceEntra || created.ExternalLogin != "operator@example.com" {
		t.Fatalf("created Entra account = %#v", created)
	}
	if _, err := authManager.CompleteEntraLogin(t.Context(), auth.ExternalIdentity{
		TenantID: "tenant", ObjectID: "object", PreferredUsername: created.ExternalLogin,
	}); err != nil {
		t.Fatal(err)
	}

	update := newJSONRequest(t, http.MethodPut, "/api/v1/admin/users/"+created.ID, updateUserRequest{
		UserUpdate: auth.UserUpdate{Access: auth.Access{
			Role: auth.RoleUser, OrganizationIDs: []string{guest.ID},
		}}, ResetExternalIdentity: true,
	}, nil)
	update.SetPathValue("userId", created.ID)
	update.AddCookie(adminCookie)
	updatedResponse := httptest.NewRecorder()
	server.updateUser(updatedResponse, update)
	if updatedResponse.Code != http.StatusOK {
		t.Fatalf("reset Entra account status = %d; body = %s", updatedResponse.Code, updatedResponse.Body.String())
	}
	var updated auth.UserView
	decodeResponse(t, updatedResponse, &updated)
	if updated.ExternalLinked {
		t.Fatalf("reset Entra account remains linked: %#v", updated)
	}

	server.entra = nil
	disabledProviderCreate := newJSONRequest(t, http.MethodPost, "/api/v1/admin/users", createUserRequest{
		Access:   auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{guest.ID}},
		Username: "Second Entra Operator", AuthSource: auth.AuthSourceEntra,
		ExternalLogin: "second@example.com",
	}, nil)
	disabledProviderCreate.AddCookie(adminCookie)
	createdResponse = httptest.NewRecorder()
	server.createUser(createdResponse, disabledProviderCreate)
	if createdResponse.Code != http.StatusBadRequest || !strings.Contains(createdResponse.Body.String(), "not enabled") {
		t.Fatalf("disabled-provider create = %d %s", createdResponse.Code, createdResponse.Body.String())
	}
}

func newAuthenticatedTestHandler(t *testing.T, config auth.Config) (http.Handler, *auth.Manager, *store.JSONStore) {
	t.Helper()
	return newAuthenticatedTestHandlerWithLogger(t, config, slog.New(slog.DiscardHandler))
}

func newAuthenticatedTestHandlerWithLogger(t *testing.T, config auth.Config, logger *slog.Logger) (http.Handler, *auth.Manager, *store.JSONStore) {
	t.Helper()
	dataDir := t.TempDir()
	topologyStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if config.GuestEnabled {
		createTestOrganization(t, topologyStore, auth.GuestOrganizationName)
	}
	authManager, err := auth.New(dataDir, config, testOrganizationRefs(t, topologyStore))
	if err != nil {
		t.Fatal(err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	return NewWithAuth(topologyStore, sse.NewBroker(), logger, static, authManager), authManager, topologyStore
}

func createTestOrganization(t *testing.T, topologyStore *store.JSONStore, name string) store.Organization {
	t.Helper()
	organization, err := topologyStore.CreateOrganization(t.Context(), name)
	if err != nil {
		t.Fatal(err)
	}
	return organization
}

func testOrganization(t *testing.T, topologyStore *store.JSONStore, name string) store.Organization {
	t.Helper()
	organization, err := topologyStore.FindOrganizationByName(t.Context(), name)
	if err != nil {
		t.Fatal(err)
	}
	return organization
}

func testOrganizationRefs(t *testing.T, topologyStore *store.JSONStore) []auth.OrganizationRef {
	t.Helper()
	organizations, err := topologyStore.ListOrganizations(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	refs := make([]auth.OrganizationRef, len(organizations))
	for index, organization := range organizations {
		refs[index] = auth.OrganizationRef{ID: organization.ID, Name: organization.Name}
	}
	return refs
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
