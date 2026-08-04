package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"netdiagram/internal/model"
	"netdiagram/internal/sse"
	"netdiagram/internal/store"
	webassets "netdiagram/web"
)

func TestHealth(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/health", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.Code)
	}
	if response.Header().Get("Content-Security-Policy") == "" {
		t.Fatal("Content-Security-Policy header is missing")
	}
}

func TestStaticFallback(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/diagram/client-route", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.Code)
	}
	if response.Header().Get("Content-Type") != "text/html; charset=utf-8" {
		t.Fatalf("Content-Type = %q, want HTML", response.Header().Get("Content-Type"))
	}
}

func TestTopologyOrganizationAndLocationRoundTrip(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Vienna core", "organization": "Example Corp", "location": "Vienna DC1", "template": "blank",
	}, http.StatusCreated)
	if topology.Organization != "Example Corp" || topology.Location != "Vienna DC1" {
		t.Fatalf("created scope = %q / %q, want Example Corp / Vienna DC1", topology.Organization, topology.Location)
	}

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/topologies", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("GET topologies status = %d, want 200", response.Code)
	}
	var summaries []model.Summary
	if err := json.Unmarshal(response.Body.Bytes(), &summaries); err != nil {
		t.Fatalf("decoding summaries: %v", err)
	}
	summaryIndex := slices.IndexFunc(summaries, func(summary model.Summary) bool { return summary.ID == topology.ID })
	if summaryIndex < 0 {
		t.Fatalf("created topology %q is missing from summaries", topology.ID)
	}
	if summaries[summaryIndex].Organization != topology.Organization || summaries[summaryIndex].Location != topology.Location {
		t.Fatalf("summary scope = %q / %q, want %q / %q",
			summaries[summaryIndex].Organization, summaries[summaryIndex].Location, topology.Organization, topology.Location)
	}
}

func TestRackCRUDReleasesMountedDevices(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Rack placement test", "template": "demo",
	}, http.StatusCreated)
	rack := model.Rack{
		Name: "RACK A01", PositionX: 80, PositionY: 80, HeightU: 12, Color: "#2c4b4e",
	}
	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/racks", rack, http.StatusCreated)
	if len(topology.Racks) != 1 || topology.Racks[0].ID == "" {
		t.Fatalf("created racks = %#v, want one identified rack", topology.Racks)
	}
	rack = topology.Racks[0]
	rack.Name = "RACK B02"
	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		"/api/v1/topologies/"+topology.ID+"/racks/"+rack.ID,
		rack,
		http.StatusOK,
	)
	if topology.Racks[0].Name != "RACK B02" {
		t.Fatalf("updated rack name = %q, want RACK B02", topology.Racks[0].Name)
	}
	device := topology.Devices[0]
	device.RackID = rack.ID
	device.RackUnit = 1
	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		"/api/v1/topologies/"+topology.ID+"/devices/"+device.ID,
		device,
		http.StatusOK,
	)
	if topology.Devices[0].RackID != rack.ID {
		t.Fatalf("mounted device rack id = %q, want %q", topology.Devices[0].RackID, rack.ID)
	}
	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/racks/"+rack.ID,
		nil,
		http.StatusOK,
	)
	if len(topology.Racks) != 0 {
		t.Fatalf("racks after delete = %d, want 0", len(topology.Racks))
	}
	if topology.Devices[0].RackID != "" || topology.Devices[0].RackUnit != 0 {
		t.Fatalf("released device mount = %q U%d, want free-floating", topology.Devices[0].RackID, topology.Devices[0].RackUnit)
	}
	if topology.Devices[0].PositionX != 110 || topology.Devices[0].PositionY != 1244 {
		t.Fatalf(
			"released device position = %.0f, %.0f, want 110, 1244",
			topology.Devices[0].PositionX,
			topology.Devices[0].PositionY,
		)
	}
}

func TestLinkGroupCRUDAllowsTopologyWarning(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Link group test", "template": "demo",
	}, http.StatusCreated)
	group := model.LinkGroup{
		Name:    "EDGE LACP",
		Mode:    model.LinkGroupModeLACP,
		LinkIDs: []string{topology.Links[0].ID, topology.Links[1].ID},
	}
	topology = requestTopology(
		t,
		handler,
		http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/link-groups",
		group,
		http.StatusCreated,
	)
	if len(topology.LinkGroups) != 1 || topology.LinkGroups[0].ID == "" {
		t.Fatalf("created link groups = %#v, want one identified group", topology.LinkGroups)
	}
	group = topology.LinkGroups[0]
	group.Mode = model.LinkGroupModeMCLAG
	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		"/api/v1/topologies/"+topology.ID+"/link-groups/"+group.ID,
		group,
		http.StatusOK,
	)
	if topology.LinkGroups[0].Mode != model.LinkGroupModeMCLAG {
		t.Fatalf("updated link group mode = %q, want MC-LAG", topology.LinkGroups[0].Mode)
	}
	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/link-groups/"+group.ID,
		nil,
		http.StatusOK,
	)
	if len(topology.LinkGroups) != 0 {
		t.Fatalf("link groups after delete = %d, want 0", len(topology.LinkGroups))
	}
}

func TestDeletingLinkPrunesSmallLinkGroup(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Link group pruning", "template": "demo",
	}, http.StatusCreated)
	group := model.LinkGroup{
		Name:    "TRUNK",
		Mode:    model.LinkGroupModeTrunk,
		LinkIDs: []string{topology.Links[0].ID, topology.Links[1].ID},
	}
	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/link-groups", group, http.StatusCreated)
	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/links/"+topology.Links[0].ID,
		nil,
		http.StatusOK,
	)
	if len(topology.LinkGroups) != 0 {
		t.Fatalf("link groups after member delete = %#v, want undersized group removed", topology.LinkGroups)
	}
}

func TestDeletingPrimaryReassignsFailoverGroup(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Failover primary pruning", "template": "demo",
	}, http.StatusCreated)
	primaryLinkID := topology.Links[0].ID
	group := model.LinkGroup{
		Name:          "WAN FAILOVER",
		Mode:          model.LinkGroupModeFailover,
		LinkIDs:       []string{topology.Links[0].ID, topology.Links[1].ID, topology.Links[2].ID},
		PrimaryLinkID: primaryLinkID,
	}
	topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/link-groups", group, http.StatusCreated)
	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/links/"+primaryLinkID,
		nil,
		http.StatusOK,
	)
	if len(topology.LinkGroups) != 1 {
		t.Fatalf("link groups after primary delete = %#v, want one group", topology.LinkGroups)
	}
	remaining := topology.LinkGroups[0]
	if remaining.PrimaryLinkID == primaryLinkID || !slices.Contains(remaining.LinkIDs, remaining.PrimaryLinkID) {
		t.Fatalf("reassigned primary = %q, members = %#v", remaining.PrimaryLinkID, remaining.LinkIDs)
	}
}

func TestSwitchSystemCRUDAndDevicePruning(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Switch system test", "template": "demo",
	}, http.StatusCreated)

	thirdSwitch := topology.Devices[2]
	thirdSwitch.ID = ""
	thirdSwitch.Name = "CORE SWITCH C"
	for index := range thirdSwitch.Ports {
		thirdSwitch.Ports[index].ID = ""
		thirdSwitch.Ports[index].DeviceID = ""
	}
	topology = requestTopology(
		t,
		handler,
		http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/devices",
		thirdSwitch,
		http.StatusCreated,
	)
	thirdSwitch = topology.Devices[len(topology.Devices)-1]

	system := model.SwitchSystem{
		Name: "CORE FABRIC",
		Mode: model.SwitchSystemModeVSF,
		DeviceIDs: []string{
			topology.Devices[2].ID,
			topology.Devices[3].ID,
			thirdSwitch.ID,
		},
	}
	topology = requestTopology(
		t,
		handler,
		http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/switch-systems",
		system,
		http.StatusCreated,
	)
	if len(topology.SwitchSystems) != 1 || topology.SwitchSystems[0].ID == "" {
		t.Fatalf("created switch systems = %#v, want one identified system", topology.SwitchSystems)
	}
	if got := topology.LogicalDeviceCount(); got != 3 {
		t.Fatalf("logical device count = %d, want 3 for 5 physical devices with one 3-member system", got)
	}

	system = topology.SwitchSystems[0]
	system.Mode = model.SwitchSystemModeMCLAG
	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		"/api/v1/topologies/"+topology.ID+"/switch-systems/"+system.ID,
		system,
		http.StatusOK,
	)
	if topology.SwitchSystems[0].Mode != model.SwitchSystemModeMCLAG {
		t.Fatalf("updated switch system mode = %q, want MC-LAG", topology.SwitchSystems[0].Mode)
	}

	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/devices/"+thirdSwitch.ID,
		nil,
		http.StatusOK,
	)
	if len(topology.SwitchSystems) != 1 || len(topology.SwitchSystems[0].DeviceIDs) != 2 {
		t.Fatalf("switch systems after first member delete = %#v, want two-member system", topology.SwitchSystems)
	}

	remainingMemberID := topology.SwitchSystems[0].DeviceIDs[0]
	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/devices/"+remainingMemberID,
		nil,
		http.StatusOK,
	)
	if len(topology.SwitchSystems) != 0 {
		t.Fatalf("switch systems after undersizing delete = %#v, want dissolved system", topology.SwitchSystems)
	}
}

func TestFirewallClusterCRUDAndActiveMemberPruning(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Firewall cluster test", "template": "demo",
	}, http.StatusCreated)

	createPeer := func(name string) model.Device {
		peer := topology.Devices[1]
		peer.ID = ""
		peer.Name = name
		for index := range peer.Ports {
			peer.Ports[index].ID = ""
			peer.Ports[index].DeviceID = ""
		}
		topology = requestTopology(
			t,
			handler,
			http.MethodPost,
			"/api/v1/topologies/"+topology.ID+"/devices",
			peer,
			http.StatusCreated,
		)
		return topology.Devices[len(topology.Devices)-1]
	}
	peerB := createPeer("EDGE FIREWALL B")
	peerC := createPeer("EDGE FIREWALL C")
	activeID := topology.Devices[1].ID
	cluster := model.FirewallCluster{
		Name:           "EDGE HA",
		Mode:           model.FirewallClusterModeActivePassive,
		DeviceIDs:      []string{activeID, peerB.ID, peerC.ID},
		ActiveDeviceID: activeID,
	}
	topology = requestTopology(
		t,
		handler,
		http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/firewall-clusters",
		cluster,
		http.StatusCreated,
	)
	if len(topology.FirewallClusters) != 1 || topology.FirewallClusters[0].ID == "" {
		t.Fatalf("created firewall clusters = %#v, want one identified cluster", topology.FirewallClusters)
	}
	if got := topology.LogicalDeviceCount(); got != 4 {
		t.Fatalf("logical device count = %d, want 4 for 6 physical devices with one 3-member cluster", got)
	}

	cluster = topology.FirewallClusters[0]
	cluster.Mode = model.FirewallClusterModeActiveActive
	cluster.ActiveDeviceID = ""
	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		"/api/v1/topologies/"+topology.ID+"/firewall-clusters/"+cluster.ID,
		cluster,
		http.StatusOK,
	)
	if topology.FirewallClusters[0].Mode != model.FirewallClusterModeActiveActive {
		t.Fatalf("updated cluster mode = %q, want active-active", topology.FirewallClusters[0].Mode)
	}

	cluster = topology.FirewallClusters[0]
	cluster.Mode = model.FirewallClusterModeActivePassive
	cluster.ActiveDeviceID = activeID
	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		"/api/v1/topologies/"+topology.ID+"/firewall-clusters/"+cluster.ID,
		cluster,
		http.StatusOK,
	)
	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/devices/"+activeID,
		nil,
		http.StatusOK,
	)
	if len(topology.FirewallClusters) != 1 || len(topology.FirewallClusters[0].DeviceIDs) != 2 {
		t.Fatalf("firewall clusters after active delete = %#v, want two-member cluster", topology.FirewallClusters)
	}
	if topology.FirewallClusters[0].ActiveDeviceID == activeID || !slices.Contains(topology.FirewallClusters[0].DeviceIDs, topology.FirewallClusters[0].ActiveDeviceID) {
		t.Fatalf("reassigned active member = %q, members = %#v", topology.FirewallClusters[0].ActiveDeviceID, topology.FirewallClusters[0].DeviceIDs)
	}

	remainingID := topology.FirewallClusters[0].DeviceIDs[0]
	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/devices/"+remainingID,
		nil,
		http.StatusOK,
	)
	if len(topology.FirewallClusters) != 0 {
		t.Fatalf("firewall clusters after undersizing delete = %#v, want dissolved cluster", topology.FirewallClusters)
	}
}

func TestConfigureLinkSynchronizesBothEndpointPorts(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Link configuration", "template": "demo",
	}, http.StatusCreated)
	link := topology.Links[0]

	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		"/api/v1/topologies/"+topology.ID+"/links/"+link.ID+"/configuration",
		linkConfigurationRequest{
			Mode:         model.PortModeTrunk,
			NativeVLAN:   10,
			AllowedVLANs: []int{30, 20, 10, 20},
			CableType:    "SMF",
		},
		http.StatusOK,
	)

	configuredLink := topology.Links[0]
	if configuredLink.CableType != "SMF" {
		t.Fatalf("configured link cable type = %q, want SMF", configuredLink.CableType)
	}
	if configuredLink.PrimaryVLAN != 10 || !slices.Equal(configuredLink.VLANIDs, []int{10, 20, 30}) {
		t.Fatalf("configured link VLANs = primary %d, channels %v", configuredLink.PrimaryVLAN, configuredLink.VLANIDs)
	}
	for _, portID := range []string{link.SourcePortID, link.TargetPortID} {
		port := findTestPort(t, topology, portID)
		if port.Mode != model.PortModeTrunk || port.NativeVLAN != 10 || !slices.Equal(port.AllowedVLANs, []int{20, 30}) {
			t.Errorf(
				"port %s configuration = mode %q, native %d, tagged %v",
				portID,
				port.Mode,
				port.NativeVLAN,
				port.AllowedVLANs,
			)
		}
	}
}

func TestSetLinkDirectionSwapsEndpointsIdempotently(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Link direction", "template": "demo",
	}, http.StatusCreated)
	original := topology.Links[0]
	path := "/api/v1/topologies/" + topology.ID + "/links/" + original.ID + "/direction"

	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		path,
		linkDirectionRequest{SourcePortID: original.TargetPortID},
		http.StatusOK,
	)
	reversed := topology.Links[0]
	sourceMatches := reversed.SourceDeviceID == original.TargetDeviceID && reversed.SourcePortID == original.TargetPortID
	targetMatches := reversed.TargetDeviceID == original.SourceDeviceID && reversed.TargetPortID == original.SourcePortID
	if !sourceMatches || !targetMatches {
		t.Fatalf("reversed link endpoints = %#v, want source and target from %#v swapped", reversed, original)
	}
	if reversed.SourceSide != original.TargetSide || reversed.TargetSide != original.SourceSide {
		t.Fatalf("reversed link sides = source %q target %q, want source %q target %q", reversed.SourceSide, reversed.TargetSide, original.TargetSide, original.SourceSide)
	}

	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		path,
		linkDirectionRequest{SourcePortID: original.TargetPortID},
		http.StatusOK,
	)
	idempotent := topology.Links[0]
	if idempotent.SourcePortID != reversed.SourcePortID || idempotent.TargetPortID != reversed.TargetPortID {
		t.Fatalf("repeated direction request changed link: first %#v, repeated %#v", reversed, idempotent)
	}
	identityMatches := idempotent.ID == original.ID && idempotent.CableType == original.CableType
	vlanMatches := idempotent.PrimaryVLAN == original.PrimaryVLAN && slices.Equal(idempotent.VLANIDs, original.VLANIDs)
	if !identityMatches || !vlanMatches {
		t.Fatalf("direction update changed non-endpoint link data: original %#v, updated %#v", original, idempotent)
	}
}

func TestSetLinkDirectionRejectsNonEndpointSource(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Invalid link direction", "template": "demo",
	}, http.StatusCreated)
	link := topology.Links[0]
	path := "/api/v1/topologies/" + topology.ID + "/links/" + link.ID + "/direction"

	body, err := json.Marshal(linkDirectionRequest{SourcePortID: "not-an-endpoint"})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPut, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("PUT %s status = %d, want %d; body = %s", path, response.Code, http.StatusBadRequest, response.Body.String())
	}
	topology = requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil, http.StatusOK)
	unchanged := topology.Links[0]
	if unchanged.SourcePortID != link.SourcePortID || unchanged.TargetPortID != link.TargetPortID {
		t.Fatalf("invalid direction request changed endpoints: before %#v, after %#v", link, unchanged)
	}
}

func TestCreateLinkActivatesBothEndpointPorts(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Automatic port activation", "template": "demo",
	}, http.StatusCreated)
	sourceDevice := topology.Devices[0]
	targetDevice := topology.Devices[1]
	sourcePort := sourceDevice.Ports[1]
	targetPort := targetDevice.Ports[2]

	topology = setTestPortStatus(t, handler, topology.ID, sourcePort, model.PortStatusDown)
	topology = setTestPortStatus(t, handler, topology.ID, targetPort, model.PortStatusDown)
	linkCount := len(topology.Links)

	topology = requestTopology(
		t,
		handler,
		http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/links",
		model.Link{
			SourceDeviceID: sourceDevice.ID,
			SourcePortID:   sourcePort.ID,
			TargetDeviceID: targetDevice.ID,
			TargetPortID:   targetPort.ID,
			CableType:      "CAT6A",
			VLANIDs:        []int{1},
			PrimaryVLAN:    1,
		},
		http.StatusCreated,
	)
	if len(topology.Links) != linkCount+1 {
		t.Fatalf("link count = %d, want %d", len(topology.Links), linkCount+1)
	}
	for _, portID := range []string{sourcePort.ID, targetPort.ID} {
		if status := findTestPort(t, topology, portID).Status; status != model.PortStatusUp {
			t.Errorf("new link endpoint %s status = %q, want %q", portID, status, model.PortStatusUp)
		}
	}

	persisted := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil, http.StatusOK)
	for _, portID := range []string{sourcePort.ID, targetPort.ID} {
		if status := findTestPort(t, persisted, portID).Status; status != model.PortStatusUp {
			t.Errorf("persisted link endpoint %s status = %q, want %q", portID, status, model.PortStatusUp)
		}
	}
}

func TestCreateLinksAtomicallyConnectsPatchPanelRanges(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Patch panel range", "template": "demo",
	}, http.StatusCreated)

	for _, name := range []string{"PATCH A", "PATCH B"} {
		topology = requestTopology(
			t,
			handler,
			http.MethodPost,
			"/api/v1/topologies/"+topology.ID+"/devices",
			testPatchPanel(name, 6),
			http.StatusCreated,
		)
	}
	source := topology.Devices[len(topology.Devices)-2]
	target := topology.Devices[len(topology.Devices)-1]
	links := make([]model.Link, 3)
	for index := range links {
		links[index] = model.Link{
			SourceDeviceID: source.ID,
			SourcePortID:   source.Ports[index].ID,
			SourceSide:     model.LinkEndpointSideRear,
			TargetDeviceID: target.ID,
			TargetPortID:   target.Ports[index+2].ID,
			TargetSide:     model.LinkEndpointSideRear,
			CableType:      "CAT6A",
		}
	}
	linkCount := len(topology.Links)
	topology = requestTopology(
		t,
		handler,
		http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/links/bulk",
		createLinksRequest{Links: links},
		http.StatusCreated,
	)
	if len(topology.Links) != linkCount+len(links) {
		t.Fatalf("link count = %d, want %d", len(topology.Links), linkCount+len(links))
	}
	for _, link := range topology.Links[linkCount:] {
		if !link.IsRearPanelConnection() {
			t.Errorf("bulk panel mapping sides = %q/%q, want rear/rear", link.SourceSide, link.TargetSide)
		}
	}
	for index := range links {
		for _, portID := range []string{source.Ports[index].ID, target.Ports[index+2].ID} {
			if status := findTestPort(t, topology, portID).Status; status != model.PortStatusDown {
				t.Errorf("rear mapping endpoint %s status = %q, want %q", portID, status, model.PortStatusDown)
			}
		}
	}

	frontLink := model.Link{
		SourceDeviceID: source.ID, SourcePortID: source.Ports[0].ID,
		TargetDeviceID: target.ID, TargetPortID: target.Ports[2].ID,
		CableType: "CAT6A",
	}
	topology = requestTopology(
		t,
		handler,
		http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/links",
		frontLink,
		http.StatusCreated,
	)
	for _, portID := range []string{source.Ports[0].ID, target.Ports[2].ID} {
		if status := findTestPort(t, topology, portID).Status; status != model.PortStatusUp {
			t.Errorf("front patch endpoint %s status = %q, want %q", portID, status, model.PortStatusUp)
		}
	}
	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/links/"+topology.Links[linkCount].ID,
		nil,
		http.StatusOK,
	)
	for _, portID := range []string{source.Ports[0].ID, target.Ports[2].ID} {
		if status := findTestPort(t, topology, portID).Status; status != model.PortStatusUp {
			t.Errorf("front endpoint %s after rear-map removal = %q, want %q", portID, status, model.PortStatusUp)
		}
	}
}

func TestCreateLinksRejectsEntirePatchPanelRange(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Rejected patch range", "template": "demo",
	}, http.StatusCreated)
	for _, name := range []string{"PATCH A", "PATCH B"} {
		topology = requestTopology(t, handler, http.MethodPost, "/api/v1/topologies/"+topology.ID+"/devices", testPatchPanel(name, 3), http.StatusCreated)
	}
	source := topology.Devices[len(topology.Devices)-2]
	target := topology.Devices[len(topology.Devices)-1]
	links := []model.Link{
		{SourceDeviceID: source.ID, SourcePortID: source.Ports[0].ID, SourceSide: model.LinkEndpointSideRear, TargetDeviceID: target.ID, TargetPortID: target.Ports[0].ID, TargetSide: model.LinkEndpointSideRear, CableType: "CAT6A"},
		{SourceDeviceID: source.ID, SourcePortID: source.Ports[0].ID, SourceSide: model.LinkEndpointSideRear, TargetDeviceID: target.ID, TargetPortID: target.Ports[1].ID, TargetSide: model.LinkEndpointSideRear, CableType: "CAT6A"},
	}
	body, err := json.Marshal(createLinksRequest{Links: links})
	if err != nil {
		t.Fatal(err)
	}
	path := "/api/v1/topologies/" + topology.ID + "/links/bulk"
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("POST %s status = %d, want %d; body = %s", path, response.Code, http.StatusBadRequest, response.Body.String())
	}
	persisted := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil, http.StatusOK)
	if len(persisted.Links) != len(topology.Links) {
		t.Fatalf("links after rejected batch = %d, want %d", len(persisted.Links), len(topology.Links))
	}
	for _, device := range []model.Device{source, target} {
		for _, port := range device.Ports {
			if status := findTestPort(t, persisted, port.ID).Status; status != model.PortStatusDown {
				t.Errorf("rejected batch endpoint %s status = %q, want %q", port.ID, status, model.PortStatusDown)
			}
		}
	}
}

func testPatchPanel(name string, portCount int) model.Device {
	ports := make([]model.Port, portCount)
	for index := range ports {
		ports[index] = model.Port{
			PortIndex: index + 1,
			Label:     fmt.Sprintf("%d", index+1),
			Type:      model.PortTypeRJ451G,
			Mode:      model.PortModeUnconfigured,
			SpeedMbps: 10000,
			Status:    model.PortStatusDown,
			Group:     "PASSIVE COPPER",
		}
	}
	return model.Device{
		Name: name, Category: model.DeviceCategoryPatchPanel, Model: "Generic Cat6A",
		PositionX: 100, PositionY: 100,
		Faceplate: model.FaceplateSpec{
			UnitsU: 1, TotalPorts: portCount, Rows: 2, PortSpacingX: 23,
			PortSpacingY: 29, VendorColor: "#262d2f", Vendor: "Generic Patch", Layout: "generic-patch-panel",
		},
		Ports: ports,
	}
}

func TestCreateLinkRejectsPortActivationAtomically(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Rejected port activation", "template": "demo",
	}, http.StatusCreated)
	sourceDevice := topology.Devices[0]
	targetDevice := topology.Devices[1]
	sourcePort := sourceDevice.Ports[1]
	occupiedTargetPort := targetDevice.Ports[0]

	topology = setTestPortStatus(t, handler, topology.ID, sourcePort, model.PortStatusDown)
	topology = setTestPortStatus(t, handler, topology.ID, occupiedTargetPort, model.PortStatusDown)
	path := "/api/v1/topologies/" + topology.ID + "/links"
	body, err := json.Marshal(model.Link{
		SourceDeviceID: sourceDevice.ID,
		SourcePortID:   sourcePort.ID,
		TargetDeviceID: targetDevice.ID,
		TargetPortID:   occupiedTargetPort.ID,
		CableType:      "CAT6A",
		VLANIDs:        []int{1},
		PrimaryVLAN:    1,
	})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("POST %s status = %d, want %d; body = %s", path, response.Code, http.StatusBadRequest, response.Body.String())
	}

	persisted := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil, http.StatusOK)
	for _, portID := range []string{sourcePort.ID, occupiedTargetPort.ID} {
		if status := findTestPort(t, persisted, portID).Status; status != model.PortStatusDown {
			t.Errorf("rejected link endpoint %s status = %q, want %q", portID, status, model.PortStatusDown)
		}
	}
}

func TestDeleteLinkDeactivatesBothEndpointPorts(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Automatic port deactivation", "template": "demo",
	}, http.StatusCreated)
	link := topology.Links[0]
	for _, portID := range []string{link.SourcePortID, link.TargetPortID} {
		if status := findTestPort(t, topology, portID).Status; status != model.PortStatusUp {
			t.Fatalf("link endpoint %s status before delete = %q, want %q", portID, status, model.PortStatusUp)
		}
	}

	topology = requestTopology(
		t,
		handler,
		http.MethodDelete,
		"/api/v1/topologies/"+topology.ID+"/links/"+link.ID,
		nil,
		http.StatusOK,
	)
	for _, portID := range []string{link.SourcePortID, link.TargetPortID} {
		if status := findTestPort(t, topology, portID).Status; status != model.PortStatusDown {
			t.Errorf("deleted link endpoint %s status = %q, want %q", portID, status, model.PortStatusDown)
		}
	}

	persisted := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil, http.StatusOK)
	for _, portID := range []string{link.SourcePortID, link.TargetPortID} {
		if status := findTestPort(t, persisted, portID).Status; status != model.PortStatusDown {
			t.Errorf("persisted deleted link endpoint %s status = %q, want %q", portID, status, model.PortStatusDown)
		}
	}
}

func TestDeleteMissingLinkDoesNotDeactivatePorts(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Rejected port deactivation", "template": "demo",
	}, http.StatusCreated)
	link := topology.Links[0]
	path := "/api/v1/topologies/" + topology.ID + "/links/00000000-0000-4000-8000-000000000000"
	request := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, path, nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("DELETE %s status = %d, want %d; body = %s", path, response.Code, http.StatusNotFound, response.Body.String())
	}

	persisted := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil, http.StatusOK)
	for _, portID := range []string{link.SourcePortID, link.TargetPortID} {
		if status := findTestPort(t, persisted, portID).Status; status != model.PortStatusUp {
			t.Errorf("endpoint %s status after rejected delete = %q, want %q", portID, status, model.PortStatusUp)
		}
	}
}

func TestConfigureLinkSynchronizesEveryLinkGroupMember(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Link group configuration", "template": "demo",
	}, http.StatusCreated)
	memberLinks := []model.Link{topology.Links[0], topology.Links[1]}
	unrelatedLinkBefore := topology.Links[2]
	unrelatedSourceBefore := findTestPort(t, topology, unrelatedLinkBefore.SourcePortID)
	unrelatedTargetBefore := findTestPort(t, topology, unrelatedLinkBefore.TargetPortID)

	topology = requestTopology(
		t,
		handler,
		http.MethodPost,
		"/api/v1/topologies/"+topology.ID+"/link-groups",
		model.LinkGroup{
			Name:    "EDGE LACP",
			Mode:    model.LinkGroupModeLACP,
			LinkIDs: []string{memberLinks[0].ID, memberLinks[1].ID},
		},
		http.StatusCreated,
	)
	topology = requestTopology(
		t,
		handler,
		http.MethodPut,
		"/api/v1/topologies/"+topology.ID+"/links/"+memberLinks[1].ID+"/configuration",
		linkConfigurationRequest{
			Mode:         model.PortModeHybrid,
			NativeVLAN:   10,
			AllowedVLANs: []int{30, 20, 10, 20},
		},
		http.StatusOK,
	)

	memberIDs := map[string]struct{}{memberLinks[0].ID: {}, memberLinks[1].ID: {}}
	configuredPorts := make(map[string]struct{}, 4)
	for _, link := range topology.Links {
		if _, isMember := memberIDs[link.ID]; !isMember {
			continue
		}
		if link.PrimaryVLAN != 10 || !slices.Equal(link.VLANIDs, []int{10, 20, 30}) {
			t.Errorf("group member %s VLANs = primary %d, channels %v", link.ID, link.PrimaryVLAN, link.VLANIDs)
		}
		configuredPorts[link.SourcePortID] = struct{}{}
		configuredPorts[link.TargetPortID] = struct{}{}
	}
	for portID := range configuredPorts {
		port := findTestPort(t, topology, portID)
		if port.Mode != model.PortModeHybrid || port.NativeVLAN != 10 || !slices.Equal(port.AllowedVLANs, []int{20, 30}) {
			t.Errorf(
				"group port %s configuration = mode %q, native %d, tagged %v",
				portID,
				port.Mode,
				port.NativeVLAN,
				port.AllowedVLANs,
			)
		}
	}

	unrelatedLinkAfter := topology.Links[2]
	if unrelatedLinkAfter.PrimaryVLAN != unrelatedLinkBefore.PrimaryVLAN || !slices.Equal(unrelatedLinkAfter.VLANIDs, unrelatedLinkBefore.VLANIDs) {
		t.Fatalf("unrelated link changed: before %#v, after %#v", unrelatedLinkBefore, unrelatedLinkAfter)
	}
	for label, pair := range map[string][2]model.Port{
		"source": {unrelatedSourceBefore, findTestPort(t, topology, unrelatedLinkBefore.SourcePortID)},
		"target": {unrelatedTargetBefore, findTestPort(t, topology, unrelatedLinkBefore.TargetPortID)},
	} {
		if pair[1].Mode != pair[0].Mode || pair[1].NativeVLAN != pair[0].NativeVLAN || !slices.Equal(pair[1].AllowedVLANs, pair[0].AllowedVLANs) {
			t.Errorf("unrelated %s port changed: before %#v, after %#v", label, pair[0], pair[1])
		}
	}
}

func TestConfigureLinkRejectsInvalidVLANAtomically(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{
		"name": "Atomic link configuration", "template": "demo",
	}, http.StatusCreated)
	linkBefore := topology.Links[0]
	sourceBefore := findTestPort(t, topology, linkBefore.SourcePortID)
	targetBefore := findTestPort(t, topology, linkBefore.TargetPortID)
	path := "/api/v1/topologies/" + topology.ID + "/links/" + linkBefore.ID + "/configuration"
	body, err := json.Marshal(linkConfigurationRequest{
		Mode: model.PortModeTrunk, NativeVLAN: 4094, AllowedVLANs: []int{20},
	})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPut, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("PUT %s status = %d, want %d; body = %s", path, response.Code, http.StatusBadRequest, response.Body.String())
	}

	topology = requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil, http.StatusOK)
	linkAfter := topology.Links[0]
	sourceAfter := findTestPort(t, topology, linkBefore.SourcePortID)
	targetAfter := findTestPort(t, topology, linkBefore.TargetPortID)
	if linkAfter.PrimaryVLAN != linkBefore.PrimaryVLAN || !slices.Equal(linkAfter.VLANIDs, linkBefore.VLANIDs) {
		t.Fatalf("link changed after rejected configuration: before %#v, after %#v", linkBefore, linkAfter)
	}
	for label, pair := range map[string][2]model.Port{
		"source": {sourceBefore, sourceAfter},
		"target": {targetBefore, targetAfter},
	} {
		if pair[1].Mode != pair[0].Mode || pair[1].NativeVLAN != pair[0].NativeVLAN || !slices.Equal(pair[1].AllowedVLANs, pair[0].AllowedVLANs) {
			t.Errorf("%s port changed after rejected configuration: before %#v, after %#v", label, pair[0], pair[1])
		}
	}
}

func BenchmarkHealth(b *testing.B) {
	handler := newTestHandler(b)
	request := httptest.NewRequestWithContext(b.Context(), http.MethodGet, "/api/v1/health", nil)
	b.ReportAllocs()
	for b.Loop() {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
	}
}

func findTestPort(t *testing.T, topology model.Topology, portID string) model.Port {
	t.Helper()
	for _, device := range topology.Devices {
		for _, port := range device.Ports {
			if port.ID == portID {
				return port
			}
		}
	}
	t.Fatalf("port %q not found", portID)
	return model.Port{}
}

func setTestPortStatus(
	t *testing.T,
	handler http.Handler,
	topologyID string,
	port model.Port,
	status string,
) model.Topology {
	t.Helper()
	port.Status = status
	return requestTopology(
		t,
		handler,
		http.MethodPut,
		"/api/v1/topologies/"+topologyID+"/ports/"+port.ID,
		port,
		http.StatusOK,
	)
}

type testingTB interface {
	TempDir() string
	Fatal(args ...any)
}

func newTestHandler(t testingTB) http.Handler {
	topologyStore, err := store.NewJSONStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		t.Fatal(err)
	}
	return New(topologyStore, sse.NewBroker(), slog.New(slog.DiscardHandler), static)
}

func requestTopology(
	t *testing.T,
	handler http.Handler,
	method string,
	path string,
	body any,
	expectedStatus int,
) model.Topology {
	t.Helper()
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), method, path, bytes.NewReader(data))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != expectedStatus {
		t.Fatalf("%s %s status = %d, want %d; body = %s", method, path, response.Code, expectedStatus, response.Body.String())
	}
	var topology model.Topology
	if err := json.Unmarshal(response.Body.Bytes(), &topology); err != nil {
		t.Fatalf("decoding topology response: %v", err)
	}
	return topology
}
