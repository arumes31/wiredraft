package handler

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"wiredraft/internal/auth"
	"wiredraft/internal/model"
)

func TestAccountAuditRecordsAccessChanges(t *testing.T) {
	t.Parallel()
	var logs bytes.Buffer
	handler, manager, _ := newAuthenticatedTestHandlerWithLogger(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	}, slog.New(slog.NewJSONHandler(&logs, nil)))
	admin := authenticateTestUser(t, manager, "admin", authTestPassword)
	organization := createTestOrganizationThroughAPI(t, handler, admin, "Private organization name")
	initial := auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{model.DefaultOrganizationID, organization.ID}}
	logs.Reset()
	response := performSessionJSONRequest(t, handler, admin, http.MethodPost, "/api/v1/admin/users", createUserRequest{
		Username: "private-account-name", Password: authTestPassword, Access: initial,
	})
	if response.Code != http.StatusCreated {
		t.Fatalf("create = %d: %s", response.Code, response.Body.String())
	}
	var user auth.UserView
	decodeResponse(t, response, &user)
	entry := readAccountAudit(t, logs.String(), "account_created")
	assertAuditAccess(t, entry["after"], user)
	if entry["user_id"] != user.ID || entry["administrator_id"] != admin.Principal.UserID {
		t.Fatalf("incorrect audit identities: %#v", entry)
	}

	for _, update := range []auth.UserUpdate{
		{Access: auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{organization.ID}}},
		{Access: auth.Access{Role: auth.RoleUser, AllOrganizations: true}},
		{Access: auth.Access{Role: auth.RoleAdmin, AllOrganizations: true}},
		{Access: auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{model.DefaultOrganizationID}}, Disabled: true},
	} {
		logs.Reset()
		response = performSessionJSONRequest(t, handler, admin, http.MethodPut, "/api/v1/admin/users/"+user.ID,
			updateUserRequest{UserUpdate: update})
		if response.Code != http.StatusOK {
			t.Fatalf("update = %d: %s", response.Code, response.Body.String())
		}
		entry = readAccountAudit(t, logs.String(), "account_updated")
		if entry["user_id"] != user.ID || entry["administrator_id"] != admin.Principal.UserID {
			t.Fatalf("incorrect audit identities: %#v", entry)
		}
		assertAuditAccess(t, entry["before"], user)
		decodeResponse(t, response, &user)
		assertAuditAccess(t, entry["after"], user)
	}

	for _, test := range []struct {
		name    string
		id      string
		session auth.Session
		access  auth.Access
		status  int
	}{
		{"unknown organization", user.ID, admin, auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{"untrusted-id"}}, http.StatusBadRequest},
		{"unknown user", "untrusted-user-id", admin, initial, http.StatusNotFound},
		{"protected administrator", admin.Principal.UserID, admin, initial, http.StatusForbidden},
		{"unauthenticated", user.ID, auth.Session{}, initial, http.StatusUnauthorized},
	} {
		t.Run(test.name, func(t *testing.T) {
			logs.Reset()
			response := performSessionJSONRequest(t, handler, test.session, http.MethodPut, "/api/v1/admin/users/"+test.id,
				updateUserRequest{UserUpdate: auth.UserUpdate{Access: test.access}})
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, test.status, response.Body.String())
			}
			if strings.Contains(logs.String(), "account_updated") || strings.Contains(logs.String(), "untrusted-") {
				t.Fatalf("rejected mutation produced an audit event or leaked input: %s", logs.String())
			}
		})
	}
}

func TestAccountAuditDoesNotReportFailedPersistence(t *testing.T) {
	t.Parallel()
	_, _, topologyStore := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	dataDir := t.TempDir()
	manager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	}, testOrganizationRefs(t, topologyStore))
	if err != nil {
		t.Fatal(err)
	}
	admin := authenticateTestUser(t, manager, "admin", authTestPassword)
	user, err := manager.CreateUser(t.Context(), "operator", authTestPassword,
		auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{model.DefaultOrganizationID}})
	if err != nil {
		t.Fatal(err)
	}
	// Block the atomic file replacement without altering the in-memory record.
	statePath := filepath.Join(dataDir, "auth", "accounts.json")
	if err := os.Rename(statePath, statePath+".saved"); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(statePath, 0o700); err != nil {
		t.Fatal(err)
	}
	var logs bytes.Buffer
	server := &Server{auth: manager, store: topologyStore, logger: slog.New(slog.NewJSONHandler(&logs, nil))}
	request := newJSONRequest(t, http.MethodPut, "/api/v1/admin/users/"+user.ID,
		updateUserRequest{UserUpdate: auth.UserUpdate{Access: auth.Access{Role: auth.RoleAdmin, AllOrganizations: true}}},
		&http.Cookie{Name: sessionCookieName, Value: admin.Token}) // #nosec G124 -- request fixture.
	request.SetPathValue("userId", user.ID)
	response := httptest.NewRecorder()
	server.updateUser(response, request)
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500: %s", response.Code, response.Body.String())
	}
	if strings.Contains(logs.String(), "account_updated") || strings.Contains(logs.String(), "account updated") {
		t.Fatalf("failed persistence emitted success: %s", logs.String())
	}
	for _, stored := range manager.Users() {
		if stored.ID == user.ID && !reflect.DeepEqual(stored, user) {
			t.Fatalf("failed persistence changed account: %#v", stored)
		}
	}
}

func TestAuditAccessEscapesLineBreaks(t *testing.T) {
	t.Parallel()
	user := auth.UserView{
		Role:            "user\r\nforged event",
		OrganizationIDs: []string{"org\nforged event", "org\rforged event", model.DefaultOrganizationID},
	}
	attribute := auditAccess("after", user)
	fields := attribute.Value.Group()
	if got := fields[0].Value.String(); got != `user\r\nforged event` {
		t.Fatalf("role = %q, want escaped line breaks", got)
	}
	wantIDs := []string{`org\nforged event`, `org\rforged event`, model.DefaultOrganizationID}
	if got := fields[2].Value.Any(); !reflect.DeepEqual(got, wantIDs) {
		t.Fatalf("organization IDs = %#v, want %#v", got, wantIDs)
	}
	if user.OrganizationIDs[0] != "org\nforged event" {
		t.Fatal("audit formatting mutated the source record")
	}
	for _, format := range []string{"json", "text"} {
		t.Run(format, func(t *testing.T) {
			var output bytes.Buffer
			var handler slog.Handler = slog.NewJSONHandler(&output, nil)
			if format == "text" {
				handler = slog.NewTextHandler(&output, nil)
			}
			slog.New(handler).Info("account created", attribute)
			if strings.Count(output.String(), "\n") != 1 || strings.Contains(output.String(), "\r") {
				t.Fatalf("audit output contains forged lines: %q", output.String())
			}
		})
	}
}

func readAccountAudit(t *testing.T, output, event string) map[string]any {
	t.Helper()
	for _, secret := range []string{"private-account-name", "Private organization name", authTestPassword, "password", "csrf", "token", "external_login"} {
		if strings.Contains(output, secret) {
			t.Fatalf("audit output contains private value %q", secret)
		}
	}
	var found map[string]any
	for line := range strings.SplitSeq(strings.TrimSpace(output), "\n") {
		var entry map[string]any
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			t.Fatal(err)
		}
		if entry["event"] == event {
			if found != nil {
				t.Fatalf("duplicate %s event", event)
			}
			found = entry
		}
	}
	if found == nil {
		t.Fatalf("missing %s audit event: %s", event, output)
	}
	return found
}

func assertAuditAccess(t *testing.T, value any, user auth.UserView) {
	t.Helper()
	ids := make([]any, len(user.OrganizationIDs))
	for index, id := range user.OrganizationIDs {
		ids[index] = id
	}
	want := map[string]any{
		"role": user.Role, "all_organizations": user.AllOrganizations,
		"organization_ids": ids, "disabled": user.Disabled,
	}
	if !reflect.DeepEqual(value, want) {
		t.Fatalf("access = %#v, want %#v", value, want)
	}
}
