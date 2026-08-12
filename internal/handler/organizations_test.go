package handler

import (
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"

	"wiredraft/internal/auth"
	"wiredraft/internal/model"
	"wiredraft/internal/sse"
	"wiredraft/internal/store"
	webassets "wiredraft/web"
)

func TestAdminOrganizationCRUDAndCounts(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)

	initial := listTestOrganizations(t, handler, adminSession)
	if len(initial) != 1 {
		t.Fatalf("initial organizations = %#v, want only Default", initial)
	}
	if initial[0].ID != model.DefaultOrganizationID || initial[0].MapCount != 1 || initial[0].UserCount != 1 || !initial[0].Protected {
		t.Fatalf("Default organization counts = %#v, want one map and one administrator", initial[0])
	}

	createdResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPost, "/api/v1/admin/organizations", organizationMutationRequest{Name: "Vienna"})
	if createdResponse.Code != http.StatusCreated {
		t.Fatalf("create organization status = %d, want 201; body = %s",
			createdResponse.Code, createdResponse.Body.String())
	}
	var created organizationView
	decodeResponse(t, createdResponse, &created)
	if created.ID == "" || created.Name != "Vienna" || created.IsDefault || created.MapCount != 0 || created.UserCount != 1 || created.Protected {
		t.Fatalf("created organization = %#v", created)
	}

	listed := listTestOrganizations(t, handler, adminSession)
	if len(listed) != 2 {
		t.Fatalf("organizations after create = %#v", listed)
	}
	created = findTestOrganizationView(t, listed, created.ID)
	if created.MapCount != 0 || created.UserCount != 1 {
		t.Fatalf("created organization counts = %#v, want zero maps and one global administrator", created)
	}

	renameResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPut, "/api/v1/admin/organizations/"+created.ID,
		organizationMutationRequest{Name: "Vienna HQ"})
	if renameResponse.Code != http.StatusOK {
		t.Fatalf("rename organization status = %d, want 200; body = %s",
			renameResponse.Code, renameResponse.Body.String())
	}
	var renamed organizationView
	decodeResponse(t, renameResponse, &renamed)
	if renamed.ID != created.ID || renamed.Name != "Vienna HQ" || renamed.MapCount != 0 || renamed.UserCount != 1 {
		t.Fatalf("renamed organization = %#v", renamed)
	}

	deleteResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodDelete, "/api/v1/admin/organizations/"+created.ID, nil)
	if deleteResponse.Code != http.StatusNoContent {
		t.Fatalf("delete organization status = %d, want 204; body = %s",
			deleteResponse.Code, deleteResponse.Body.String())
	}
	if remaining := listTestOrganizations(t, handler, adminSession); len(remaining) != 1 || remaining[0].ID != model.DefaultOrganizationID {
		t.Fatalf("organizations after delete = %#v, want only Default", remaining)
	}
}

func TestDefaultOrganizationIsProtectedByAdminAPI(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)

	renameResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPut, "/api/v1/admin/organizations/"+model.DefaultOrganizationID,
		organizationMutationRequest{Name: "Renamed"})
	if renameResponse.Code != http.StatusForbidden {
		t.Fatalf("rename Default status = %d, want 403; body = %s",
			renameResponse.Code, renameResponse.Body.String())
	}
	deleteResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodDelete, "/api/v1/admin/organizations/"+model.DefaultOrganizationID, nil)
	if deleteResponse.Code != http.StatusForbidden {
		t.Fatalf("delete Default status = %d, want 403; body = %s",
			deleteResponse.Code, deleteResponse.Body.String())
	}
}

func TestActiveGuestOrganizationIsProtectedByAdminAPI(t *testing.T) {
	t.Parallel()
	handler, authManager, topologyStore := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword, GuestEnabled: true,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	guest := testOrganization(t, topologyStore, auth.GuestOrganizationName)

	listed := listTestOrganizations(t, handler, adminSession)
	if view := findTestOrganizationView(t, listed, guest.ID); !view.Protected {
		t.Fatalf("active Guest organization = %#v, want protected", view)
	}
	renameResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPut, "/api/v1/admin/organizations/"+guest.ID,
		organizationMutationRequest{Name: "Renamed Guest"})
	if renameResponse.Code != http.StatusForbidden {
		t.Fatalf("rename active Guest status = %d, want 403; body = %s",
			renameResponse.Code, renameResponse.Body.String())
	}
	deleteResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodDelete, "/api/v1/admin/organizations/"+guest.ID, nil)
	if deleteResponse.Code != http.StatusConflict {
		t.Fatalf("delete active Guest status = %d, want 409; body = %s",
			deleteResponse.Code, deleteResponse.Body.String())
	}
}

func TestReferencedOrganizationCannotBeDeleted(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	organization := createTestOrganizationThroughAPI(t, handler, adminSession, "Production")

	mapResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPost, "/api/v1/topologies", createTopologyRequest{
			Name: "Production map", OrganizationID: organization.ID, Template: "blank",
		})
	if mapResponse.Code != http.StatusCreated {
		t.Fatalf("create topology status = %d, want 201; body = %s", mapResponse.Code, mapResponse.Body.String())
	}

	deleteResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodDelete, "/api/v1/admin/organizations/"+organization.ID, nil)
	if deleteResponse.Code != http.StatusConflict {
		t.Fatalf("delete referenced organization status = %d, want 409; body = %s",
			deleteResponse.Code, deleteResponse.Body.String())
	}
	listed := listTestOrganizations(t, handler, adminSession)
	production := findTestOrganizationView(t, listed, organization.ID)
	if production.MapCount != 1 {
		t.Fatalf("referenced organization = %#v, want one map", production)
	}
}

func TestDeletingOrganizationCleansAssignmentsAndRevokesSessions(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	vienna := createTestOrganizationThroughAPI(t, handler, adminSession, "Vienna")
	berlin := createTestOrganizationThroughAPI(t, handler, adminSession, "Berlin")

	user, err := authManager.CreateUser(t.Context(), "multi-org-user", authTestPassword, auth.Access{
		Role: auth.RoleUser, OrganizationIDs: []string{vienna.ID, berlin.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	userSession := authenticateTestUser(t, authManager, user.Username, authTestPassword)
	if _, exists := authManager.Session(userSession.Token); !exists {
		t.Fatal("newly created user session is missing")
	}

	deleteResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodDelete, "/api/v1/admin/organizations/"+vienna.ID, nil)
	if deleteResponse.Code != http.StatusNoContent {
		t.Fatalf("delete organization status = %d, want 204; body = %s",
			deleteResponse.Code, deleteResponse.Body.String())
	}
	if _, exists := authManager.Session(userSession.Token); exists {
		t.Fatal("organization grant change did not revoke the affected user session")
	}
	users := authManager.Users()
	index := slices.IndexFunc(users, func(candidate auth.UserView) bool { return candidate.ID == user.ID })
	if index < 0 {
		t.Fatal("updated user was not found")
	}
	if !slices.Equal(users[index].OrganizationIDs, []string{berlin.ID}) {
		t.Fatalf("remaining organization assignments = %#v, want only Berlin", users[index].OrganizationIDs)
	}
}

func TestZeroGrantUserCanBeDisabledAfterLastOrganizationDeletion(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	organization := createTestOrganizationThroughAPI(t, handler, adminSession, "Temporary")
	user, err := authManager.CreateUser(t.Context(), "temporary-user", authTestPassword, auth.Access{
		Role: auth.RoleUser, OrganizationIDs: []string{organization.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	entraUser, err := authManager.CreateEntraUser(t.Context(), "temporary-entra", "temporary@example.com", auth.Access{
		Role: auth.RoleUser, OrganizationIDs: []string{organization.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := authManager.CompleteEntraLogin(t.Context(), auth.ExternalIdentity{
		TenantID: "tenant", ObjectID: "object", PreferredUsername: "temporary@example.com",
	}); err != nil {
		t.Fatal(err)
	}

	deleteResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodDelete, "/api/v1/admin/organizations/"+organization.ID, nil)
	if deleteResponse.Code != http.StatusNoContent {
		t.Fatalf("delete last organization status = %d, want 204; body = %s",
			deleteResponse.Code, deleteResponse.Body.String())
	}
	updateResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPut, "/api/v1/admin/users/"+user.ID, updateUserRequest{
			UserUpdate: auth.UserUpdate{
				Access:   auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{}},
				Disabled: true,
			},
		})
	if updateResponse.Code != http.StatusOK {
		t.Fatalf("disable zero-grant user status = %d, want 200; body = %s",
			updateResponse.Code, updateResponse.Body.String())
	}
	var updated auth.UserView
	decodeResponse(t, updateResponse, &updated)
	if !updated.Disabled || updated.Role != auth.RoleUser || updated.AllOrganizations || len(updated.OrganizationIDs) != 0 {
		t.Fatalf("disabled zero-grant user = %#v", updated)
	}
	resetResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPut, "/api/v1/admin/users/"+entraUser.ID, updateUserRequest{
			UserUpdate: auth.UserUpdate{
				Access: auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{}},
			},
			ResetExternalIdentity: true,
		})
	if resetResponse.Code != http.StatusOK {
		t.Fatalf("reset zero-grant Entra user status = %d, want 200; body = %s",
			resetResponse.Code, resetResponse.Body.String())
	}
	decodeResponse(t, resetResponse, &updated)
	if updated.ExternalLinked || updated.Role != auth.RoleUser || updated.AllOrganizations || len(updated.OrganizationIDs) != 0 {
		t.Fatalf("reset zero-grant Entra user = %#v", updated)
	}

	createResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPost, "/api/v1/admin/users", map[string]any{
			"username": "new-zero-grant", "password": authTestPassword,
			"role": auth.RoleUser, "allOrganizations": false, "organizationIds": []string{},
		})
	if createResponse.Code != http.StatusBadRequest {
		t.Fatalf("deliberate zero-grant creation status = %d, want 400; body = %s",
			createResponse.Code, createResponse.Body.String())
	}
}

func TestAdminUserAccessPayloads(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	vienna := createTestOrganizationThroughAPI(t, handler, adminSession, "Vienna")
	berlin := createTestOrganizationThroughAPI(t, handler, adminSession, "Berlin")

	tests := []struct {
		name       string
		body       map[string]any
		wantStatus int
		assert     func(*testing.T, auth.UserView)
	}{
		{
			name: "multiple scoped organizations",
			body: map[string]any{
				"username": "scoped-user", "password": authTestPassword,
				"role": auth.RoleUser, "allOrganizations": false,
				"organizationIds": []string{vienna.ID, berlin.ID, vienna.ID},
			},
			wantStatus: http.StatusCreated,
			assert: func(t *testing.T, user auth.UserView) {
				t.Helper()
				want := []string{berlin.ID, vienna.ID}
				slices.Sort(want)
				if user.Role != auth.RoleUser || user.AllOrganizations || !slices.Equal(user.OrganizationIDs, want) {
					t.Fatalf("scoped user = %#v", user)
				}
			},
		},
		{
			name: "non-admin global access",
			body: map[string]any{
				"username": "global-user", "password": authTestPassword,
				"role": auth.RoleUser, "allOrganizations": true, "organizationIds": []string{},
			},
			wantStatus: http.StatusCreated,
			assert: func(t *testing.T, user auth.UserView) {
				t.Helper()
				if user.Role != auth.RoleUser || !user.AllOrganizations || len(user.OrganizationIDs) != 0 {
					t.Fatalf("global user = %#v", user)
				}
			},
		},
		{
			name: "application administrator",
			body: map[string]any{
				"username": "application-admin", "password": authTestPassword,
				"role": auth.RoleAdmin, "allOrganizations": true, "organizationIds": []string{},
			},
			wantStatus: http.StatusCreated,
			assert: func(t *testing.T, user auth.UserView) {
				t.Helper()
				if user.Role != auth.RoleAdmin || !user.AllOrganizations || len(user.OrganizationIDs) != 0 {
					t.Fatalf("application administrator = %#v", user)
				}
			},
		},
		{
			name: "global access cannot include explicit assignments",
			body: map[string]any{
				"username": "invalid-global", "password": authTestPassword,
				"role": auth.RoleUser, "allOrganizations": true, "organizationIds": []string{vienna.ID},
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "administrator must explicitly use global access",
			body: map[string]any{
				"username": "invalid-admin", "password": authTestPassword,
				"role": auth.RoleAdmin, "allOrganizations": false, "organizationIds": []string{},
			},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := performSessionJSONRequest(t, handler, adminSession,
				http.MethodPost, "/api/v1/admin/users", test.body)
			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", response.Code, test.wantStatus, response.Body.String())
			}
			if test.assert != nil {
				var user auth.UserView
				decodeResponse(t, response, &user)
				test.assert(t, user)
			}
		})
	}
}

func TestAdminRejectsPasswordForEntraAccount(t *testing.T) {
	t.Parallel()
	_, authManager, topologyStore := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	handler := newHandler(
		topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static,
		authManager, nil, &fakeEntraAuthenticator{},
	)
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)

	response := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPost, "/api/v1/admin/users", map[string]any{
			"username": "entra-user", "password": authTestPassword,
			"authSource": auth.AuthSourceEntra, "externalLogin": "entra@example.com",
			"role": auth.RoleUser, "allOrganizations": false,
			"organizationIds": []string{model.DefaultOrganizationID},
		})
	if response.Code != http.StatusBadRequest {
		t.Fatalf("Entra account with password status = %d, want 400; body = %s",
			response.Code, response.Body.String())
	}
	if slices.ContainsFunc(authManager.Users(), func(user auth.UserView) bool { return user.Username == "entra-user" }) {
		t.Fatal("rejected Entra account was persisted")
	}
}

func TestAdminLocalIdentityResetDoesNotPartiallyUpdateAccess(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	user, err := authManager.CreateUser(
		t.Context(), "local-user", authTestPassword,
		auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{model.DefaultOrganizationID}},
	)
	if err != nil {
		t.Fatal(err)
	}

	response := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPut, "/api/v1/admin/users/"+user.ID, map[string]any{
			"role": auth.RoleAdmin, "allOrganizations": true, "organizationIds": []string{},
			"disabled": true, "resetExternalIdentity": true,
		})
	if response.Code != http.StatusForbidden {
		t.Fatalf("local identity reset status = %d, want 403; body = %s", response.Code, response.Body.String())
	}
	current := authManager.Users()[slices.IndexFunc(authManager.Users(), func(candidate auth.UserView) bool {
		return candidate.ID == user.ID
	})]
	if current.Role != auth.RoleUser || current.AllOrganizations || current.Disabled ||
		!slices.Equal(current.OrganizationIDs, []string{model.DefaultOrganizationID}) {
		t.Fatalf("rejected identity reset partially updated account: %#v", current)
	}
}

func TestScopedUserOrganizationAuthorizationForCreateAndMove(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	vienna := createTestOrganizationThroughAPI(t, handler, adminSession, "Vienna")
	berlin := createTestOrganizationThroughAPI(t, handler, adminSession, "Berlin")

	user, err := authManager.CreateUser(t.Context(), "vienna-user", authTestPassword, auth.Access{
		Role: auth.RoleUser, OrganizationIDs: []string{vienna.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	userSession := authenticateTestUser(t, authManager, user.Username, authTestPassword)

	allowedCreate := performSessionJSONRequest(t, handler, userSession,
		http.MethodPost, "/api/v1/topologies", createTopologyRequest{
			Name: "Vienna map", OrganizationID: vienna.ID, Template: "blank",
		})
	if allowedCreate.Code != http.StatusCreated {
		t.Fatalf("create in assigned organization status = %d, want 201; body = %s",
			allowedCreate.Code, allowedCreate.Body.String())
	}
	var topology model.Topology
	decodeResponse(t, allowedCreate, &topology)

	unauthorizedCreate := performSessionJSONRequest(t, handler, userSession,
		http.MethodPost, "/api/v1/topologies", createTopologyRequest{
			Name: "Berlin map", OrganizationID: berlin.ID, Template: "blank",
		})
	if unauthorizedCreate.Code != http.StatusForbidden {
		t.Fatalf("create in unassigned organization status = %d, want 403; body = %s",
			unauthorizedCreate.Code, unauthorizedCreate.Body.String())
	}

	const unknownOrganizationID = "11111111-1111-4111-8111-111111111111"
	unknownCreate := performSessionJSONRequest(t, handler, userSession,
		http.MethodPost, "/api/v1/topologies", createTopologyRequest{
			Name: "Unknown map", OrganizationID: unknownOrganizationID, Template: "blank",
		})
	if unknownCreate.Code != http.StatusBadRequest {
		t.Fatalf("create in unknown organization status = %d, want 400; body = %s",
			unknownCreate.Code, unknownCreate.Body.String())
	}

	berlinTopologyResponse := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPost, "/api/v1/topologies", createTopologyRequest{
			Name: "Berlin private", OrganizationID: berlin.ID, Template: "blank",
		})
	if berlinTopologyResponse.Code != http.StatusCreated {
		t.Fatalf("admin create in Berlin status = %d, want 201; body = %s",
			berlinTopologyResponse.Code, berlinTopologyResponse.Body.String())
	}
	var berlinTopology model.Topology
	decodeResponse(t, berlinTopologyResponse, &berlinTopology)
	deniedRead := performSessionJSONRequest(t, handler, userSession,
		http.MethodGet, "/api/v1/topologies/"+berlinTopology.ID, nil)
	if deniedRead.Code != http.StatusNotFound {
		t.Fatalf("cross-organization read status = %d, want 404", deniedRead.Code)
	}

	moveToBerlin := topology
	moveToBerlin.OrganizationID = berlin.ID
	moveToBerlin.Organization = berlin.Name
	unauthorizedMove := performSessionJSONRequest(t, handler, userSession,
		http.MethodPut, "/api/v1/topologies/"+topology.ID, moveToBerlin)
	if unauthorizedMove.Code != http.StatusForbidden {
		t.Fatalf("move to unassigned organization status = %d, want 403; body = %s",
			unauthorizedMove.Code, unauthorizedMove.Body.String())
	}

	moveToUnknown := topology
	moveToUnknown.OrganizationID = unknownOrganizationID
	moveToUnknown.Organization = "Unknown"
	unknownMove := performSessionJSONRequest(t, handler, userSession,
		http.MethodPut, "/api/v1/topologies/"+topology.ID, moveToUnknown)
	if unknownMove.Code != http.StatusBadRequest {
		t.Fatalf("move to unknown organization status = %d, want 400; body = %s",
			unknownMove.Code, unknownMove.Body.String())
	}
}

func authenticateTestUser(t *testing.T, authManager *auth.Manager, username, password string) auth.Session {
	t.Helper()
	challenge, err := authManager.StartLogin(username, password, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if challenge.Next != "setup" || challenge.Enrollment == nil {
		t.Fatalf("fresh test account login challenge = %#v, want TOTP setup", challenge)
	}
	code, err := totp.GenerateCode(challenge.Enrollment.ManualCode, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	session, _, err := authManager.CompleteSetup(t.Context(), challenge.Challenge, code)
	if err != nil {
		t.Fatal(err)
	}
	return session
}

func performSessionJSONRequest(
	t *testing.T,
	handler http.Handler,
	session auth.Session,
	method string,
	path string,
	body any,
) *httptest.ResponseRecorder {
	t.Helper()
	cookie := &http.Cookie{Name: sessionCookieName, Value: session.Token} // #nosec G124 -- request fixture, not a response cookie.
	request := newJSONRequest(t, method, path, body, cookie)
	if isUnsafeMethod(method) {
		request.Header.Set("Origin", "http://example.com")
		request.Header.Set("X-CSRF-Token", session.CSRFToken)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func createTestOrganizationThroughAPI(
	t *testing.T,
	handler http.Handler,
	adminSession auth.Session,
	name string,
) store.Organization {
	t.Helper()
	response := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPost, "/api/v1/admin/organizations", organizationMutationRequest{Name: name})
	if response.Code != http.StatusCreated {
		t.Fatalf("create organization %q status = %d, want 201; body = %s",
			name, response.Code, response.Body.String())
	}
	var organization store.Organization
	decodeResponse(t, response, &organization)
	return organization
}

func listTestOrganizations(t *testing.T, handler http.Handler, adminSession auth.Session) []organizationView {
	t.Helper()
	response := performSessionJSONRequest(t, handler, adminSession,
		http.MethodGet, "/api/v1/admin/organizations", nil)
	if response.Code != http.StatusOK {
		t.Fatalf("list organizations status = %d, want 200; body = %s", response.Code, response.Body.String())
	}
	var payload struct {
		Organizations []organizationView `json:"organizations"`
	}
	decodeResponse(t, response, &payload)
	return payload.Organizations
}

func findTestOrganizationView(t *testing.T, organizations []organizationView, id string) organizationView {
	t.Helper()
	index := slices.IndexFunc(organizations, func(organization organizationView) bool { return organization.ID == id })
	if index < 0 {
		t.Fatalf("organization %q not found in %#v", id, organizations)
	}
	return organizations[index]
}
