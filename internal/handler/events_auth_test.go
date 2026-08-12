package handler

import (
	"bufio"
	"context"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"wiredraft/internal/auth"
	"wiredraft/internal/model"
	"wiredraft/internal/sse"
	"wiredraft/internal/store"
	webassets "wiredraft/web"
)

func TestEventStreamStopsBeforeDeliveringDataAfterSessionRevocation(t *testing.T) {
	fixture := newEventAuthorizationFixture(t)
	testServer := httptest.NewServer(fixture.handler)
	t.Cleanup(testServer.Close)
	reader, closeStream := openTestEventStream(t, testServer.URL, fixture.session, fixture.topology.ID)
	t.Cleanup(closeStream)

	if _, err := fixture.auth.UpdateUser(t.Context(), fixture.user.ID, auth.UserUpdate{
		Access: auth.Access{
			Role: auth.RoleUser, OrganizationIDs: []string{fixture.vienna.ID},
		},
		Disabled: true,
	}); err != nil {
		t.Fatal(err)
	}
	if _, exists := fixture.auth.Session(fixture.session.Token); exists {
		t.Fatal("authorization change did not revoke the user session")
	}

	expectEventStreamClosedBeforeData(t, reader, fixture.broker, fixture.topology.ID, fixture.topology)
}

func TestEventStreamStopsBeforeDeliveringDataAfterTopologyAccessIsLost(t *testing.T) {
	fixture := newEventAuthorizationFixture(t)
	testServer := httptest.NewServer(fixture.handler)
	t.Cleanup(testServer.Close)
	reader, closeStream := openTestEventStream(t, testServer.URL, fixture.session, fixture.topology.ID)
	t.Cleanup(closeStream)

	moved, err := fixture.store.Mutate(t.Context(), fixture.topology.ID, func(topology *model.Topology) error {
		topology.OrganizationID = fixture.berlin.ID
		topology.Organization = fixture.berlin.Name
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, exists := fixture.auth.Session(fixture.session.Token); !exists {
		t.Fatal("topology move unexpectedly revoked the otherwise valid session")
	}

	expectEventStreamClosedBeforeData(t, reader, fixture.broker, moved.ID, moved)
}

type eventAuthorizationFixture struct {
	handler  http.Handler
	broker   *sse.Broker
	auth     *auth.Manager
	store    *store.JSONStore
	user     auth.UserView
	session  auth.Session
	topology model.Topology
	vienna   store.Organization
	berlin   store.Organization
}

func newEventAuthorizationFixture(t *testing.T) eventAuthorizationFixture {
	t.Helper()
	dataDir := t.TempDir()
	topologyStore, err := store.NewJSONStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	vienna := createTestOrganization(t, topologyStore, "Vienna")
	berlin := createTestOrganization(t, topologyStore, "Berlin")
	topology, err := newBlankTopology("Vienna event stream")
	if err != nil {
		t.Fatal(err)
	}
	topology.OrganizationID = vienna.ID
	topology.Organization = vienna.Name
	topology, err = topologyStore.Create(t.Context(), topology)
	if err != nil {
		t.Fatal(err)
	}

	authManager, err := auth.New(dataDir, auth.Config{
		AdminUsername: "admin", AdminPassword: authTestPassword,
	}, testOrganizationRefs(t, topologyStore))
	if err != nil {
		t.Fatal(err)
	}
	user, err := authManager.CreateUser(
		t.Context(), "event-user", authTestPassword,
		auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{vienna.ID}},
	)
	if err != nil {
		t.Fatal(err)
	}
	session := authenticateTestUser(t, authManager, user.Username, authTestPassword)
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	broker := sse.NewBroker()
	t.Cleanup(broker.Close)
	return eventAuthorizationFixture{
		handler: newHandler(
			topologyStore, broker, slog.New(slog.DiscardHandler), static,
			authManager, nil, nil,
		),
		broker: broker, auth: authManager, store: topologyStore,
		user: user, session: session, topology: topology, vienna: vienna, berlin: berlin,
	}
}

func openTestEventStream(
	t *testing.T,
	serverURL string,
	session auth.Session,
	topologyID string,
) (*bufio.Reader, func()) {
	t.Helper()
	ctx, cancel := context.WithCancel(t.Context())
	request, err := http.NewRequestWithContext(
		ctx, http.MethodGet, serverURL+"/api/v1/topologies/"+topologyID+"/events", nil,
	)
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	request.AddCookie(&http.Cookie{ // #nosec G124 -- request fixture, not a response cookie.
		Name: sessionCookieName, Value: session.Token,
	})
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	closeStream := func() {
		cancel()
		_ = response.Body.Close()
	}
	if response.StatusCode != http.StatusOK {
		closeStream()
		t.Fatalf("open event stream status = %d, want 200", response.StatusCode)
	}
	reader := bufio.NewReader(response.Body)
	connected, err := reader.ReadString('\n')
	if err != nil {
		closeStream()
		t.Fatal(err)
	}
	separator, err := reader.ReadString('\n')
	if err != nil {
		closeStream()
		t.Fatal(err)
	}
	if connected != ": connected\n" || separator != "\n" {
		closeStream()
		t.Fatalf("event stream prelude = %q%q", connected, separator)
	}
	return reader, closeStream
}

func expectEventStreamClosedBeforeData(
	t *testing.T,
	reader *bufio.Reader,
	broker *sse.Broker,
	topologyID string,
	payload model.Topology,
) {
	t.Helper()
	stopPublishing := make(chan struct{})
	publishingDone := make(chan struct{})
	go func() {
		defer close(publishingDone)
		ticker := time.NewTicker(5 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-stopPublishing:
				return
			case <-ticker.C:
				_ = broker.Publish(topologyID, "topology_updated", payload)
			}
		}
	}()

	type readResult struct {
		data []byte
		err  error
	}
	result := make(chan readResult, 1)
	go func() {
		data, err := io.ReadAll(reader)
		result <- readResult{data: data, err: err}
	}()
	select {
	case read := <-result:
		close(stopPublishing)
		<-publishingDone
		if read.err != nil {
			t.Fatalf("reading closed event stream: %v", read.err)
		}
		if len(read.data) != 0 {
			t.Fatalf("event stream disclosed data after authorization loss: %q", read.data)
		}
	case <-time.After(2 * time.Second):
		close(stopPublishing)
		<-publishingDone
		t.Fatal("event stream remained open after authorization loss")
	}
}
