package handler

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"

	"wiredraft/internal/auth"
	"wiredraft/internal/model"
	"wiredraft/internal/sse"
	"wiredraft/internal/store"
	webassets "wiredraft/web"
)

func TestMutationReauthorizesLockedTopologySnapshot(t *testing.T) {
	fixture := newAtomicAuthorizationFixture(t)
	request := newJSONRequest(t, http.MethodPost,
		"/api/v1/topologies/"+fixture.topology.ID+"/racks", model.Rack{Name: "must not be added"},
		&http.Cookie{Name: sessionCookieName, Value: fixture.session.Token}, // #nosec G124 -- request fixture.
	)
	request.Header.Set("Origin", "http://example.com")
	request.Header.Set("X-CSRF-Token", fixture.session.CSRFToken)
	response := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		fixture.handler.ServeHTTP(response, request)
		close(done)
	}()

	<-fixture.store.firstGet
	fixture.store.releaseGet <- struct{}{}
	<-fixture.store.mutationLocked
	if _, err := fixture.auth.UpdateUser(t.Context(), fixture.user.ID, auth.UserUpdate{
		Access:   auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{fixture.organization.ID}},
		Disabled: true,
	}); err != nil {
		t.Fatal(err)
	}
	fixture.store.releaseMutation <- struct{}{}
	<-done
	if response.Code != http.StatusNotFound {
		t.Fatalf("mutation after session revocation status = %d, want 404; body = %s",
			response.Code, response.Body.String())
	}
	stored, err := fixture.store.JSONStore.Get(t.Context(), fixture.topology.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(stored.Racks) != 0 {
		t.Fatalf("revoked mutation changed topology: %#v", stored.Racks)
	}
}

func TestDeleteReauthorizesLockedTopologySnapshot(t *testing.T) {
	fixture := newAtomicAuthorizationFixture(t)
	request := newJSONRequest(t, http.MethodDelete,
		"/api/v1/topologies/"+fixture.topology.ID, nil,
		&http.Cookie{Name: sessionCookieName, Value: fixture.session.Token}, // #nosec G124 -- request fixture.
	)
	request.Header.Set("Origin", "http://example.com")
	request.Header.Set("X-CSRF-Token", fixture.session.CSRFToken)
	response := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		fixture.handler.ServeHTTP(response, request)
		close(done)
	}()

	<-fixture.store.firstGet
	fixture.store.releaseGet <- struct{}{}
	<-fixture.store.deletionLocked
	if _, err := fixture.auth.UpdateUser(t.Context(), fixture.user.ID, auth.UserUpdate{
		Access:   auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{fixture.organization.ID}},
		Disabled: true,
	}); err != nil {
		t.Fatal(err)
	}
	fixture.store.releaseDeletion <- struct{}{}
	<-done
	if response.Code != http.StatusNotFound {
		t.Fatalf("delete after session revocation status = %d, want 404; body = %s",
			response.Code, response.Body.String())
	}
	if _, err := fixture.store.JSONStore.Get(t.Context(), fixture.topology.ID); err != nil {
		t.Fatalf("revoked delete removed topology: %v", err)
	}
}

func TestReadReauthorizesExactFetchedTopologySnapshot(t *testing.T) {
	fixture := newAtomicAuthorizationFixture(t)
	request := newJSONRequest(t, http.MethodGet,
		"/api/v1/topologies/"+fixture.topology.ID, nil,
		&http.Cookie{Name: sessionCookieName, Value: fixture.session.Token}, // #nosec G124 -- request fixture.
	)
	response := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		fixture.handler.ServeHTTP(response, request)
		close(done)
	}()

	<-fixture.store.firstGet
	if _, err := fixture.store.Mutate(t.Context(), fixture.topology.ID, func(topology *model.Topology) error {
		topology.OrganizationID = fixture.deniedOrganization.ID
		topology.Organization = fixture.deniedOrganization.Name
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	fixture.store.releaseGet <- struct{}{}
	<-done
	if response.Code != http.StatusNotFound {
		t.Fatalf("read after ownership move status = %d, want 404; body = %s",
			response.Code, response.Body.String())
	}
}

func TestCreateReauthorizesSessionAfterOrganizationResolution(t *testing.T) {
	fixture := newOrganizationResolutionFixture(t, false)
	request := newJSONRequest(t, http.MethodPost, "/api/v1/topologies", createTopologyRequest{
		Name: "must not be created", OrganizationID: fixture.vienna.ID, Template: "blank",
	}, &http.Cookie{Name: sessionCookieName, Value: fixture.session.Token}) // #nosec G124 -- request fixture.
	request.Header.Set("Origin", "http://example.com")
	request.Header.Set("X-CSRF-Token", fixture.session.CSRFToken)
	response := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		fixture.handler.ServeHTTP(response, request)
		close(done)
	}()

	<-fixture.store.resolved
	if _, err := fixture.auth.UpdateUser(t.Context(), fixture.user.ID, auth.UserUpdate{
		Access:   auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{fixture.vienna.ID}},
		Disabled: true,
	}); err != nil {
		t.Fatal(err)
	}
	fixture.store.release <- struct{}{}
	<-done
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("create after session revocation status = %d, want 401; body = %s",
			response.Code, response.Body.String())
	}
	summaries, err := fixture.store.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if slices.ContainsFunc(summaries, func(summary model.Summary) bool { return summary.Name == "must not be created" }) {
		t.Fatal("create committed after session revocation")
	}
}

func TestMoveReauthorizesSessionAfterTargetResolution(t *testing.T) {
	fixture := newOrganizationResolutionFixture(t, true)
	request := newJSONRequest(t, http.MethodPut, "/api/v1/topologies/"+fixture.topology.ID, func() model.Topology {
		next := fixture.topology
		next.OrganizationID = fixture.berlin.ID
		next.Organization = fixture.berlin.Name
		return next
	}(), &http.Cookie{Name: sessionCookieName, Value: fixture.session.Token}) // #nosec G124 -- request fixture.
	request.Header.Set("Origin", "http://example.com")
	request.Header.Set("X-CSRF-Token", fixture.session.CSRFToken)
	response := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		fixture.handler.ServeHTTP(response, request)
		close(done)
	}()

	<-fixture.store.resolved
	if _, err := fixture.auth.UpdateUser(t.Context(), fixture.user.ID, auth.UserUpdate{
		Access: auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{fixture.vienna.ID}},
	}); err != nil {
		t.Fatal(err)
	}
	fixture.store.release <- struct{}{}
	<-done
	if response.Code != http.StatusNotFound {
		t.Fatalf("move after access revocation status = %d, want 404; body = %s",
			response.Code, response.Body.String())
	}
	persisted, err := fixture.store.Get(t.Context(), fixture.topology.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.OrganizationID != fixture.vienna.ID {
		t.Fatalf("revoked move changed organization to %q", persisted.OrganizationID)
	}
}

func TestAdminWriteReauthorizesSessionAfterDirectoryLock(t *testing.T) {
	dataDir := t.TempDir()
	jsonStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	}, testOrganizationRefs(t, jsonStore))
	if err != nil {
		t.Fatal(err)
	}
	staleAdministrator, err := authManager.CreateUser(
		t.Context(), "stale-admin", authTestPassword,
		auth.Access{Role: auth.RoleAdmin, AllOrganizations: true},
	)
	if err != nil {
		t.Fatal(err)
	}
	bootstrapSession := authenticateTestUser(t, authManager, "admin", authTestPassword)
	staleSession := authenticateTestUser(t, authManager, staleAdministrator.Username, authTestPassword)

	blockingStore := &adminDirectoryStore{
		JSONStore:   jsonStore,
		listStarted: make(chan struct{}),
		releaseList: make(chan struct{}),
	}
	server := &Server{
		store: blockingStore, auth: authManager, logger: slog.New(slog.DiscardHandler),
	}
	staleRequestAuthorized := make(chan struct{})
	mux := http.NewServeMux()
	mux.HandleFunc("PUT /api/v1/admin/users/{userId}", server.adminOnly(server.updateUser))
	mux.HandleFunc("POST /api/v1/admin/organizations", server.adminOnly(func(w http.ResponseWriter, request *http.Request) {
		close(staleRequestAuthorized)
		server.createOrganization(w, request)
	}))

	demotionRequest := newJSONRequest(t, http.MethodPut,
		"/api/v1/admin/users/"+staleAdministrator.ID,
		updateUserRequest{UserUpdate: auth.UserUpdate{Access: auth.Access{
			Role: auth.RoleUser, OrganizationIDs: []string{model.DefaultOrganizationID},
		}}},
		&http.Cookie{Name: sessionCookieName, Value: bootstrapSession.Token}, // #nosec G124 -- request fixture.
	)
	demotionRequest.Header.Set("Origin", "http://example.com")
	demotionRequest.Header.Set("X-CSRF-Token", bootstrapSession.CSRFToken)
	demotionResponse := httptest.NewRecorder()
	demotionDone := make(chan struct{})
	go func() {
		mux.ServeHTTP(demotionResponse, demotionRequest)
		close(demotionDone)
	}()
	<-blockingStore.listStarted

	staleRequest := newJSONRequest(t, http.MethodPost, "/api/v1/admin/organizations",
		organizationMutationRequest{Name: "must not be created"},
		&http.Cookie{Name: sessionCookieName, Value: staleSession.Token}, // #nosec G124 -- request fixture.
	)
	staleRequest.Header.Set("Origin", "http://example.com")
	staleRequest.Header.Set("X-CSRF-Token", staleSession.CSRFToken)
	staleResponse := httptest.NewRecorder()
	staleDone := make(chan struct{})
	go func() {
		mux.ServeHTTP(staleResponse, staleRequest)
		close(staleDone)
	}()
	<-staleRequestAuthorized

	close(blockingStore.releaseList)
	<-demotionDone
	<-staleDone
	if demotionResponse.Code != http.StatusOK {
		t.Fatalf("demotion status = %d, want 200; body = %s", demotionResponse.Code, demotionResponse.Body.String())
	}
	if staleResponse.Code != http.StatusUnauthorized {
		t.Fatalf("stale admin write status = %d, want 401; body = %s", staleResponse.Code, staleResponse.Body.String())
	}
	organizations, err := jsonStore.ListOrganizations(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if slices.ContainsFunc(organizations, func(organization store.Organization) bool {
		return organization.Name == "must not be created"
	}) {
		t.Fatal("revoked administrator created an organization")
	}
}

type adminDirectoryStore struct {
	*store.JSONStore
	listStarted chan struct{}
	releaseList chan struct{}
	once        sync.Once
}

func (s *adminDirectoryStore) ListOrganizations(ctx context.Context) ([]store.Organization, error) {
	organizations, err := s.JSONStore.ListOrganizations(ctx)
	s.once.Do(func() {
		close(s.listStarted)
		<-s.releaseList
	})
	return organizations, err
}

type organizationResolutionStore struct {
	*store.JSONStore
	targetID string
	resolved chan struct{}
	release  chan struct{}
	once     sync.Once
}

func (s *organizationResolutionStore) GetOrganization(ctx context.Context, id string) (store.Organization, error) {
	organization, err := s.JSONStore.GetOrganization(ctx, id)
	if id == s.targetID {
		s.once.Do(func() {
			close(s.resolved)
			<-s.release
		})
	}
	return organization, err
}

type organizationResolutionFixture struct {
	handler  http.Handler
	store    *organizationResolutionStore
	auth     *auth.Manager
	user     auth.UserView
	session  auth.Session
	topology model.Topology
	vienna   store.Organization
	berlin   store.Organization
}

func newOrganizationResolutionFixture(t *testing.T, targetBerlin bool) organizationResolutionFixture {
	t.Helper()
	dataDir := t.TempDir()
	jsonStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	vienna := createTestOrganization(t, jsonStore, "Vienna")
	berlin := createTestOrganization(t, jsonStore, "Berlin")
	topology, err := newBlankTopology("Vienna topology")
	if err != nil {
		t.Fatal(err)
	}
	topology.OrganizationID = vienna.ID
	topology.Organization = vienna.Name
	topology, err = jsonStore.Create(t.Context(), topology)
	if err != nil {
		t.Fatal(err)
	}
	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	}, testOrganizationRefs(t, jsonStore))
	if err != nil {
		t.Fatal(err)
	}
	user, err := authManager.CreateUser(t.Context(), "resolution-user", authTestPassword, auth.Access{
		Role: auth.RoleUser, OrganizationIDs: []string{vienna.ID, berlin.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	session := authenticateTestUser(t, authManager, user.Username, authTestPassword)
	targetID := vienna.ID
	if targetBerlin {
		targetID = berlin.ID
	}
	topologyStore := &organizationResolutionStore{
		JSONStore: jsonStore, targetID: targetID,
		resolved: make(chan struct{}), release: make(chan struct{}),
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	broker := sse.NewBroker()
	t.Cleanup(broker.Close)
	return organizationResolutionFixture{
		handler: newHandler(
			topologyStore, broker, slog.New(slog.DiscardHandler), static,
			authManager, nil, nil,
		),
		store: topologyStore, auth: authManager, user: user, session: session,
		topology: topology, vienna: vienna, berlin: berlin,
	}
}

type atomicAuthorizationStore struct {
	*store.JSONStore
	once            sync.Once
	firstGet        chan struct{}
	releaseGet      chan struct{}
	mutationLocked  chan struct{}
	releaseMutation chan struct{}
	deletionLocked  chan struct{}
	releaseDeletion chan struct{}
}

func (s *atomicAuthorizationStore) Get(ctx context.Context, id string) (model.Topology, error) {
	topology, err := s.JSONStore.Get(ctx, id)
	s.once.Do(func() {
		close(s.firstGet)
		<-s.releaseGet
	})
	return topology, err
}

func (s *atomicAuthorizationStore) MutateAtRevision(
	ctx context.Context,
	id string,
	expectedRevision uint64,
	mutation func(*model.Topology) error,
) (model.Topology, error) {
	return s.JSONStore.MutateAtRevision(ctx, id, expectedRevision, func(topology *model.Topology) error {
		close(s.mutationLocked)
		<-s.releaseMutation
		return mutation(topology)
	})
}

func (s *atomicAuthorizationStore) DeleteAtRevision(
	ctx context.Context,
	id string,
	expectedRevision uint64,
	authorize func(model.Topology) error,
) error {
	return s.JSONStore.DeleteAtRevision(ctx, id, expectedRevision, func(topology model.Topology) error {
		close(s.deletionLocked)
		<-s.releaseDeletion
		return authorize(topology)
	})
}

type atomicAuthorizationFixture struct {
	handler            http.Handler
	store              *atomicAuthorizationStore
	auth               *auth.Manager
	user               auth.UserView
	session            auth.Session
	topology           model.Topology
	organization       store.Organization
	deniedOrganization store.Organization
}

func newAtomicAuthorizationFixture(t *testing.T) atomicAuthorizationFixture {
	t.Helper()
	dataDir := t.TempDir()
	jsonStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	organization := createTestOrganization(t, jsonStore, "Vienna")
	deniedOrganization := createTestOrganization(t, jsonStore, "Berlin")
	topology, err := newBlankTopology("Atomic authorization")
	if err != nil {
		t.Fatal(err)
	}
	topology.OrganizationID = organization.ID
	topology.Organization = organization.Name
	topology, err = jsonStore.Create(t.Context(), topology)
	if err != nil {
		t.Fatal(err)
	}
	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	}, testOrganizationRefs(t, jsonStore))
	if err != nil {
		t.Fatal(err)
	}
	user, err := authManager.CreateUser(t.Context(), "atomic-user", authTestPassword, auth.Access{
		Role: auth.RoleUser, OrganizationIDs: []string{organization.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	session := authenticateTestUser(t, authManager, user.Username, authTestPassword)
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	topologyStore := &atomicAuthorizationStore{
		JSONStore: jsonStore, firstGet: make(chan struct{}), releaseGet: make(chan struct{}),
		mutationLocked: make(chan struct{}), releaseMutation: make(chan struct{}),
		deletionLocked: make(chan struct{}), releaseDeletion: make(chan struct{}),
	}
	broker := sse.NewBroker()
	t.Cleanup(broker.Close)
	return atomicAuthorizationFixture{
		handler: newHandler(
			topologyStore, broker, slog.New(slog.DiscardHandler), static,
			authManager, nil, nil,
		),
		store: topologyStore, auth: authManager, user: user, session: session,
		topology: topology, organization: organization,
		deniedOrganization: deniedOrganization,
	}
}
