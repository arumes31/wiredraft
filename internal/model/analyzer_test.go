package model

import (
	"slices"
	"strconv"
	"testing"
)

func TestAnalyzeAllowsInvalidLACPWithWarning(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	groupID := mustID(t)
	topology.LinkGroups = []LinkGroup{{
		ID:      groupID,
		Name:    "EDGE BUNDLE",
		Mode:    LinkGroupModeLACP,
		LinkIDs: []string{topology.Links[0].ID, topology.Links[1].ID},
	}}
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() error = %v, want advisory-only protocol validation", err)
	}
	analysis := Analyze(topology)
	if !slices.ContainsFunc(analysis.Issues, func(issue Issue) bool {
		return issue.Kind == "lacp_device_pair_mismatch" && issue.GroupID == groupID
	}) {
		t.Fatalf("Analyze() issues = %#v, want LACP topology warning", analysis.Issues)
	}
}

func TestAnalyzeValidMCLAGShapeHasNoTopologyWarning(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	additional := newTestLink(t, topology.Devices[1].Ports[2], topology.Devices[3].Ports[1])
	additional.CableType = topology.Links[1].CableType
	topology.Links = append(topology.Links, additional)
	groupID := mustID(t)
	topology.LinkGroups = []LinkGroup{{
		ID:      groupID,
		Name:    "DUAL CORE",
		Mode:    LinkGroupModeMCLAG,
		LinkIDs: []string{topology.Links[1].ID, additional.ID},
	}}
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	analysis := Analyze(topology)
	if slices.ContainsFunc(analysis.Issues, func(issue Issue) bool {
		return issue.Kind == "mclag_topology_mismatch" && issue.GroupID == groupID
	}) {
		t.Fatalf("Analyze() issues = %#v, want valid MC-LAG shape", analysis.Issues)
	}
}

func TestAnalyzeLogicalSwitchSystemAvoidsFalseLACPPairWarning(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	additional := newTestLink(t, topology.Devices[1].Ports[2], topology.Devices[3].Ports[1])
	additional.CableType = topology.Links[1].CableType
	topology.Links = append(topology.Links, additional)
	systemID := mustID(t)
	topology.SwitchSystems = []SwitchSystem{{
		ID: systemID, Name: "CORE VSF", Mode: SwitchSystemModeVSF,
		DeviceIDs: []string{topology.Devices[2].ID, topology.Devices[3].ID},
	}}
	groupID := mustID(t)
	topology.LinkGroups = []LinkGroup{{
		ID: groupID, Name: "VSF UPLINK", Mode: LinkGroupModeLACP,
		LinkIDs: []string{topology.Links[1].ID, additional.ID},
	}}

	analysis := Analyze(topology)
	if slices.ContainsFunc(analysis.Issues, func(issue Issue) bool {
		return issue.Kind == "lacp_device_pair_mismatch" && issue.GroupID == groupID
	}) {
		t.Fatalf("Analyze() issues = %#v, VSF members must be compared as one logical device pair", analysis.Issues)
	}
}

func TestAnalyzeTrunkVLANMismatchWarning(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.Links[2].VLANIDs = []int{1, 10}
	groupID := mustID(t)
	topology.LinkGroups = []LinkGroup{{
		ID:      groupID,
		Name:    "TAGGED PATHS",
		Mode:    LinkGroupModeTrunk,
		LinkIDs: []string{topology.Links[1].ID, topology.Links[2].ID},
	}}
	analysis := Analyze(topology)
	if !slices.ContainsFunc(analysis.Issues, func(issue Issue) bool {
		return issue.Kind == "trunk_vlan_mismatch" && issue.GroupID == groupID
	}) {
		t.Fatalf("Analyze() issues = %#v, want trunk VLAN warning", analysis.Issues)
	}
}

func TestAnalyzeFailoverVLANMismatchWarning(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.Links[2].VLANIDs = []int{1, 10}
	groupID := mustID(t)
	topology.LinkGroups = []LinkGroup{{
		ID:            groupID,
		Name:          "WAN FAILOVER",
		Mode:          LinkGroupModeFailover,
		LinkIDs:       []string{topology.Links[1].ID, topology.Links[2].ID},
		PrimaryLinkID: topology.Links[1].ID,
	}}
	analysis := Analyze(topology)
	if !slices.ContainsFunc(analysis.Issues, func(issue Issue) bool {
		return issue.Kind == "failover_vlan_mismatch" && issue.GroupID == groupID
	}) {
		t.Fatalf("Analyze() issues = %#v, want failover VLAN warning", analysis.Issues)
	}
}

func TestAnalyzeStaticServerWithIndependentNICLinks(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	server := newTestServer(t, 2)
	topology.Devices = append(topology.Devices, server)
	topology.Links = append(topology.Links,
		newTestLink(t, topology.Devices[2].Ports[2], server.Ports[0]),
		newTestLink(t, topology.Devices[3].Ports[1], server.Ports[1]),
	)
	if err := topology.Validate(); err != nil {
		t.Fatalf("multi-homed server Validate() error = %v", err)
	}
	if analysis := Analyze(topology); len(analysis.Loops) != 0 {
		t.Fatalf("Analyze() loops = %#v, server endpoints must not create switching loops", analysis.Loops)
	}
}

func TestAnalyzeStaticServerRejectsSecondCableOnSameNIC(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	server := newTestServer(t, 2)
	topology.Devices = append(topology.Devices, server)
	topology.Links = append(topology.Links,
		newTestLink(t, topology.Devices[2].Ports[2], server.Ports[0]),
		newTestLink(t, topology.Devices[3].Ports[1], server.Ports[0]),
	)
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want occupied server NIC error")
	}
}

func TestTracePathDoesNotForwardThroughStaticServer(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.Links = []Link{}
	server := newTestServer(t, 2)
	topology.Devices = append(topology.Devices, server)
	topology.Links = append(topology.Links,
		newTestLink(t, topology.Devices[2].Ports[2], server.Ports[0]),
		newTestLink(t, topology.Devices[3].Ports[1], server.Ports[1]),
	)
	if err := topology.Validate(); err != nil {
		t.Fatalf("server trace fixture Validate() error = %v", err)
	}
	if _, err := TracePath(
		topology,
		topology.Devices[2].Ports[2].ID,
		topology.Devices[3].Ports[1].ID,
		1,
	); err == nil {
		t.Fatal("TracePath() error = nil, want no path through server endpoint")
	}
}

func TestTracePathDoesNotBridgeStaticServerNICs(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	server := newTestServer(t, 2)
	topology.Devices = append(topology.Devices, server)
	if _, err := TracePath(topology, server.Ports[0].ID, server.Ports[1].ID, 1); err == nil {
		t.Fatal("TracePath() error = nil, want no internal path between server NICs")
	}
}

func newTestServer(t *testing.T, nicCount int) Device {
	t.Helper()
	deviceID := mustID(t)
	ports := make([]Port, 0, nicCount)
	for index := range nicCount {
		ports = append(ports, Port{
			ID:           mustID(t),
			DeviceID:     deviceID,
			PortIndex:    index + 1,
			Label:        "NIC" + strconv.Itoa(index+1),
			Type:         PortTypeSFPPlus10G,
			Mode:         PortModeAccess,
			NativeVLAN:   1,
			AllowedVLANs: []int{},
			SpeedMbps:    10000,
			Status:       "up",
		})
	}
	return Device{
		ID:        deviceID,
		Name:      "STATIC SERVER",
		Category:  DeviceCategoryServer,
		Model:     "Generic rack server",
		PositionX: 900,
		PositionY: 200,
		Faceplate: FaceplateSpec{
			UnitsU:       2,
			TotalPorts:   nicCount,
			Rows:         1,
			PortSpacingX: 23,
			PortSpacingY: 29,
			VendorColor:  "#30383b",
			Vendor:       "Static",
			Layout:       "static-server",
		},
		Ports: ports,
	}
}

func newTestLink(t *testing.T, source, target Port) Link {
	t.Helper()
	return Link{
		ID:             mustID(t),
		SourceDeviceID: source.DeviceID,
		SourcePortID:   source.ID,
		TargetDeviceID: target.DeviceID,
		TargetPortID:   target.ID,
		CableType:      "FIBER",
		VLANIDs:        []int{1},
		PrimaryVLAN:    1,
	}
}
