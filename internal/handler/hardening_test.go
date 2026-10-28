package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"wiredraft/internal/auth"
	"wiredraft/internal/model"
)

func TestReplaceTopologyRequiresIfMatch(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Revisioned", "template": "blank",
	}, http.StatusCreated)
	body, err := json.Marshal(topology)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPut, "/api/v1/topologies/"+topology.ID, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusPreconditionRequired {
		t.Fatalf("replace without If-Match status = %d, want 428", response.Code)
	}
}

func TestShareGrantsAlwaysExpire(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Expiring shares", "template": "blank",
	}, http.StatusCreated)
	sharesPath := "/api/v1/topologies/" + topology.ID + "/shares"
	createShare := func(input createShareGrantRequest) *httptest.ResponseRecorder {
		body, err := json.Marshal(input)
		if err != nil {
			t.Fatal(err)
		}
		request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, sharesPath, bytes.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response
	}

	response := createShare(createShareGrantRequest{Name: "Default"})
	if response.Code != http.StatusCreated {
		t.Fatalf("create share status = %d; body = %s", response.Code, response.Body.String())
	}
	var share shareGrantResponse
	if err := json.Unmarshal(response.Body.Bytes(), &share); err != nil {
		t.Fatal(err)
	}
	if share.ExpiresAt == nil || time.Until(*share.ExpiresAt) > defaultShareLifetime || time.Until(*share.ExpiresAt) < defaultShareLifetime-time.Hour {
		t.Fatalf("default share expiry = %v, want about %v from now", share.ExpiresAt, defaultShareLifetime)
	}

	tooLate := time.Now().Add(maxShareLifetime + 24*time.Hour)
	if response := createShare(createShareGrantRequest{Name: "Forever", ExpiresAt: &tooLate}); response.Code != http.StatusBadRequest {
		t.Fatalf("share beyond the maximum lifetime status = %d, want 400", response.Code)
	}
	past := time.Now().Add(-time.Hour)
	if response := createShare(createShareGrantRequest{Name: "Expired", ExpiresAt: &past}); response.Code != http.StatusBadRequest {
		t.Fatalf("already-expired share status = %d, want 400", response.Code)
	}
}

func TestGuestSessionAttributionAndSessionReplacement(t *testing.T) {
	t.Parallel()
	handler, _, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "operator", AdminPassword: authTestPassword, GuestEnabled: true,
	})
	guestLogin := func(cookie *http.Cookie) (*http.Cookie, string) {
		request := newJSONRequest(t, http.MethodPost, "/api/v1/auth/guest", map[string]string{}, cookie)
		request.Header.Set("Origin", "http://example.com")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("guest login status = %d; body = %s", response.Code, response.Body.String())
		}
		var session struct {
			Session auth.SessionView `json:"session"`
		}
		decodeResponse(t, response, &session)
		return response.Result().Cookies()[0], session.Session.CSRFToken
	}
	first, _ := guestLogin(nil)
	second, csrf := guestLogin(first)
	status := performJSONRequest(t, handler, http.MethodGet, "/api/v1/auth/status", nil, first)
	var view struct {
		Session auth.SessionView `json:"session"`
	}
	decodeResponse(t, status, &view)
	if view.Session.Authenticated {
		t.Fatal("the session replaced by a new sign-in is still valid")
	}

	send := func(method, path string, body any) *httptest.ResponseRecorder {
		request := newJSONRequest(t, method, path, body, second)
		request.Header.Set("Origin", "http://example.com")
		request.Header.Set("X-CSRF-Token", csrf)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response
	}
	created := send(http.MethodPost, "/api/v1/topologies", map[string]string{"name": "Guest map", "template": "demo"})
	if created.Code != http.StatusCreated {
		t.Fatalf("guest create status = %d; body = %s", created.Code, created.Body.String())
	}
	var topology model.Topology
	decodeResponse(t, created, &topology)
	commented := send(http.MethodPost, "/api/v1/topologies/"+topology.ID+"/comments", createCommentThreadRequest{
		Anchor: model.CommentAnchor{Kind: model.CommentAnchorDevice, TargetID: topology.Devices[0].ID},
		Author: "Network Admin", Body: "Spoofed attribution",
	})
	if commented.Code != http.StatusCreated {
		t.Fatalf("comment status = %d; body = %s", commented.Code, commented.Body.String())
	}
	decodeResponse(t, commented, &topology)
	if author := topology.CommentThreads[0].Messages[0].Author; author != "Guest" {
		t.Fatalf("comment author = %q, want the session principal", author)
	}
}

func TestGuestOrganizationNameIsReserved(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	response := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPost, "/api/v1/admin/organizations", organizationMutationRequest{Name: " guest "})
	if response.Code != http.StatusConflict {
		t.Fatalf("create organization named guest status = %d, want 409", response.Code)
	}
	member := createTestOrganizationThroughAPI(t, handler, adminSession, "Branch")
	response = performSessionJSONRequest(t, handler, adminSession,
		http.MethodPut, "/api/v1/admin/organizations/"+member.ID, organizationMutationRequest{Name: "GUEST"})
	if response.Code != http.StatusConflict {
		t.Fatalf("rename organization to GUEST status = %d, want 409", response.Code)
	}
}

func TestOrganizationMoveRevokesShareGrants(t *testing.T) {
	t.Parallel()
	handler, authManager, _ := newAuthenticatedTestHandler(t, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	})
	adminSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	target := createTestOrganizationThroughAPI(t, handler, adminSession, "Restricted")
	created := performSessionJSONRequest(t, handler, adminSession,
		http.MethodPost, "/api/v1/topologies", map[string]string{"name": "Moving map", "template": "blank"})
	if created.Code != http.StatusCreated {
		t.Fatalf("create topology status = %d; body = %s", created.Code, created.Body.String())
	}
	var topology model.Topology
	decodeResponse(t, created, &topology)
	sharesPath := "/api/v1/topologies/" + topology.ID + "/shares"
	if response := performSessionJSONRequest(t, handler, adminSession, http.MethodPost, sharesPath,
		createShareGrantRequest{Name: "Vendor"}); response.Code != http.StatusCreated {
		t.Fatalf("create share status = %d; body = %s", response.Code, response.Body.String())
	}
	current := performSessionJSONRequest(t, handler, adminSession, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil)
	decodeResponse(t, current, &topology)
	topology.OrganizationID = target.ID
	topology.Organization = target.Name
	moved := performSessionJSONRequest(t, handler, adminSession, http.MethodPut, "/api/v1/topologies/"+topology.ID, topology)
	if moved.Code != http.StatusOK {
		t.Fatalf("move status = %d; body = %s", moved.Code, moved.Body.String())
	}
	listed := performSessionJSONRequest(t, handler, adminSession, http.MethodGet, sharesPath, nil)
	var shares []shareGrantResponse
	decodeResponse(t, listed, &shares)
	if len(shares) != 0 {
		t.Fatalf("share grants after organization move = %d, want 0", len(shares))
	}
}

func TestLegacyShareGrantsWithoutExpiryStopWorking(t *testing.T) {
	t.Parallel()
	now := time.Now()
	recent := model.ShareGrant{CreatedAt: now.Add(-24 * time.Hour)}
	if !shareExpiry(recent).After(now) {
		t.Fatal("recent legacy grant already expired")
	}
	old := model.ShareGrant{CreatedAt: now.Add(-maxShareLifetime - time.Hour)}
	if shareExpiry(old).After(now) {
		t.Fatal("legacy grant without expiry is still valid after the maximum lifetime")
	}
	explicit := now.Add(time.Hour)
	if got := shareExpiry(model.ShareGrant{CreatedAt: now.Add(-maxShareLifetime * 2), ExpiresAt: &explicit}); !got.Equal(explicit) {
		t.Fatalf("explicit expiry = %v, want %v", got, explicit)
	}
}
