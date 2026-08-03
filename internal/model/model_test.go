package model

import (
	"slices"
	"testing"
)

func TestNewDemo(t *testing.T) {
	t.Parallel()
	topology, err := NewDemo()
	if err != nil {
		t.Fatalf("NewDemo() error = %v", err)
	}
	if err := topology.Validate(); err != nil {
		t.Fatalf("demo Validate() error = %v", err)
	}
	if len(topology.Devices) != 4 {
		t.Fatalf("len(Devices) = %d, want 4", len(topology.Devices))
	}
	if len(topology.VLANs) != 4 {
		t.Fatalf("len(VLANs) = %d, want 4", len(topology.VLANs))
	}
}

func TestTopologyValidateOccupiedPort(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	duplicate := topology.Links[0]
	duplicate.ID = mustID(t)
	topology.Links = append(topology.Links, duplicate)
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want occupied port error")
	}
}

func TestTopologyValidateAnnotationsAndPortMedia(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.Devices[0].Ports[0].MediaType = "DAC"
	topology.Annotations = []Annotation{{
		ID: mustID(t), Type: "text", X1: 120, Y1: 80, X2: 120, Y2: 80,
		Text: "Meet-me room demarcation", Color: "#f0b35a",
	}}
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	topology.Annotations[0].Type = "ellipse"
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want unsupported annotation type error")
	}
}

func TestTopologyValidateLinkGroup(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.LinkGroups = []LinkGroup{{
		ID:      mustID(t),
		Name:    "CORE UPLINK",
		Mode:    LinkGroupModeLACP,
		LinkIDs: []string{topology.Links[0].ID, topology.Links[1].ID},
	}}
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() error = %v, protocol-shape mismatches must remain advisory", err)
	}
}

func TestTopologyValidateRejectsLinkInTwoGroups(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	sharedLinkID := topology.Links[0].ID
	topology.LinkGroups = []LinkGroup{
		{ID: mustID(t), Name: "GROUP A", Mode: LinkGroupModeTrunk, LinkIDs: []string{sharedLinkID, topology.Links[1].ID}},
		{ID: mustID(t), Name: "GROUP B", Mode: LinkGroupModeLACP, LinkIDs: []string{sharedLinkID, topology.Links[2].ID}},
	}
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want duplicate group membership error")
	}
}

func TestTopologyValidateFailoverPrimary(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.LinkGroups = []LinkGroup{{
		ID:            mustID(t),
		Name:          "WAN FAILOVER",
		Mode:          LinkGroupModeFailover,
		LinkIDs:       []string{topology.Links[0].ID, topology.Links[1].ID},
		PrimaryLinkID: topology.Links[0].ID,
	}}
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	topology.LinkGroups[0].PrimaryLinkID = topology.Links[2].ID
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want non-member failover primary error")
	}
}

func TestTopologyValidateSwitchSystemAndLogicalCount(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.SwitchSystems = []SwitchSystem{{
		ID:        mustID(t),
		Name:      "CORE FABRIC",
		Mode:      SwitchSystemModeVSF,
		DeviceIDs: []string{topology.Devices[2].ID, topology.Devices[3].ID},
	}}
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if got := topology.LogicalDeviceCount(); got != 3 {
		t.Fatalf("LogicalDeviceCount() = %d, want 3 logical units for 4 physical devices", got)
	}
}

func TestTopologyValidateRejectsInvalidSwitchSystemMembership(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.SwitchSystems = []SwitchSystem{{
		ID:        mustID(t),
		Name:      "INVALID FABRIC",
		Mode:      SwitchSystemModeMCLAG,
		DeviceIDs: []string{topology.Devices[0].ID, topology.Devices[2].ID},
	}}
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want non-switch member error")
	}

	topology = mustDemo(t)
	sharedDeviceID := topology.Devices[2].ID
	topology.SwitchSystems = []SwitchSystem{
		{ID: mustID(t), Name: "FABRIC A", Mode: SwitchSystemModeStack, DeviceIDs: []string{sharedDeviceID, topology.Devices[3].ID}},
		{ID: mustID(t), Name: "FABRIC B", Mode: SwitchSystemModeCustom, DeviceIDs: []string{sharedDeviceID, topology.Devices[3].ID}},
	}
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want duplicate switch-system membership error")
	}
}

func TestTopologyValidateFirewallClusterAndLogicalCount(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	peerID := appendFirewallPeer(t, &topology, "EDGE FIREWALL B")
	topology.FirewallClusters = []FirewallCluster{{
		ID:             mustID(t),
		Name:           "EDGE HA",
		Mode:           FirewallClusterModeActivePassive,
		DeviceIDs:      []string{topology.Devices[1].ID, peerID},
		ActiveDeviceID: topology.Devices[1].ID,
	}}
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if got := topology.LogicalDeviceCount(); got != 4 {
		t.Fatalf("LogicalDeviceCount() = %d, want 4 logical units for 5 physical devices", got)
	}
	topology.FirewallClusters[0].Mode = FirewallClusterModeActiveActive
	topology.FirewallClusters[0].ActiveDeviceID = ""
	if err := topology.Validate(); err != nil {
		t.Fatalf("Validate() active-active error = %v", err)
	}
}

func TestTopologyValidateRejectsInvalidFirewallClusterRole(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	peerID := appendFirewallPeer(t, &topology, "EDGE FIREWALL B")
	topology.FirewallClusters = []FirewallCluster{{
		ID:             mustID(t),
		Name:           "EDGE HA",
		Mode:           FirewallClusterModeActivePassive,
		DeviceIDs:      []string{topology.Devices[1].ID, peerID},
		ActiveDeviceID: topology.Devices[2].ID,
	}}
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want non-member active device error")
	}
	topology.FirewallClusters[0].ActiveDeviceID = topology.Devices[1].ID
	topology.FirewallClusters[0].DeviceIDs[1] = topology.Devices[2].ID
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want non-firewall member error")
	}
}

func TestExpandedPhysicalPortTypesValidate(t *testing.T) {
	t.Parallel()
	tests := []struct {
		portType PortType
		speed    int
	}{
		{PortTypeRJ45MGIG, 5000},
		{PortTypeDSLRJ11, 1000},
		{PortTypeQSFPPlus40G, 40000},
		{PortTypeQSFP56200G, 200000},
		{PortTypeQSFPDD400G, 400000},
		{PortTypeCFP100G, 100000},
		{PortTypeCFP2100G, 100000},
		{PortTypeCFP4100G, 100000},
		{PortTypeOSFP800G, 800000},
		{PortTypeFiberLC, 0},
		{PortTypeFiberSC, 0},
		{PortTypeFiberMPO, 0},
		{PortTypeUSBMicro, 0},
		{PortTypeUSBC, 0},
		{PortTypeStack, 40000},
	}
	for _, test := range tests {
		topology := mustDemo(t)
		topology.Devices[0].Ports[0].Type = test.portType
		topology.Devices[0].Ports[0].SpeedMbps = test.speed
		if err := topology.Validate(); err != nil {
			t.Errorf("Validate() port type %q error = %v", test.portType, err)
		}
	}
}

func TestAnalyze(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.Devices[1].Ports[0].NativeVLAN = 20
	analysis := Analyze(topology)
	if !slices.ContainsFunc(analysis.Issues, func(issue Issue) bool {
		return issue.Kind == "native_vlan_mismatch" && issue.LinkID == topology.Links[0].ID
	}) {
		t.Fatalf("Analyze() issues = %#v, want native VLAN mismatch", analysis.Issues)
	}
}

func TestDeviceInventoryAndSTPMetadataValidation(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	device := topology.Devices[2]
	device.SerialNumber = "CN42ABC123"
	device.AssetTag = "NET-CORE-001"
	device.Hostname = "core-sw-01.example.net"
	device.ManagementIP = "2001:db8::10"
	device.Owner = "Network Operations"
	device.Location = DeviceLocation{
		Site: "Vienna", Building: "DC1", Floor: "2", Room: "MDF", Rack: "A01", RackUnit: 24,
	}
	device.STPPriority = 4096
	if err := device.Validate(vlanIDSet(topology.VLANs)); err != nil {
		t.Fatalf("valid inventory metadata Validate() error = %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*Device)
	}{
		{name: "hostname", mutate: func(device *Device) { device.Hostname = "-invalid-host" }},
		{name: "management ip", mutate: func(device *Device) { device.ManagementIP = "192.0.2.999" }},
		{name: "rack unit", mutate: func(device *Device) { device.Location.RackUnit = 49 }},
		{name: "stp priority", mutate: func(device *Device) { device.STPPriority = 5000 }},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			next := device
			test.mutate(&next)
			if err := next.Validate(vlanIDSet(topology.VLANs)); err == nil {
				t.Fatalf("Validate() error = nil, want invalid %s error", test.name)
			}
		})
	}
}

func vlanIDSet(vlans []VLAN) map[int]struct{} {
	ids := make(map[int]struct{}, len(vlans))
	for _, vlan := range vlans {
		ids[vlan.ID] = struct{}{}
	}
	return ids
}

func TestAnalyzeDoesNotTreatFirewallAsSTPBridge(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.Links = append(topology.Links, Link{
		ID:             mustID(t),
		SourceDeviceID: topology.Devices[1].ID,
		SourcePortID:   topology.Devices[1].Ports[2].ID,
		TargetDeviceID: topology.Devices[3].ID,
		TargetPortID:   topology.Devices[3].Ports[1].ID,
		CableType:      "CAT6A",
		VLANIDs:        []int{1},
		PrimaryVLAN:    1,
	})
	if err := topology.Validate(); err != nil {
		t.Fatalf("loop fixture Validate() error = %v", err)
	}
	analysis := Analyze(topology)
	if slices.ContainsFunc(analysis.Loops, func(loop Loop) bool { return loop.VLANID == 1 }) {
		t.Fatalf("Analyze() loops = %#v, firewall path must not be treated as an STP bridge cycle", analysis.Loops)
	}
}

func TestTracePath(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	links, err := TracePath(topology, topology.Devices[0].Ports[0].ID, topology.Devices[3].Ports[0].ID, 1)
	if err != nil {
		t.Fatalf("TracePath() error = %v", err)
	}
	if len(links) != 3 {
		t.Fatalf("TracePath() links = %d, want 3", len(links))
	}
}

func TestTracePathMissingVLAN(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	if _, err := TracePath(topology, topology.Devices[0].Ports[0].ID, topology.Devices[3].Ports[0].ID, 30); err == nil {
		t.Fatal("TracePath() error = nil, want missing VLAN error")
	}
}

func BenchmarkTopologyClone(b *testing.B) {
	topology, err := NewDemo()
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	for b.Loop() {
		if _, err := topology.Clone(); err != nil {
			b.Fatal(err)
		}
	}
}

func mustDemo(t *testing.T) Topology {
	t.Helper()
	topology, err := NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	return topology
}

func mustID(t *testing.T) string {
	t.Helper()
	id, err := NewID()
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func appendFirewallPeer(t *testing.T, topology *Topology, name string) string {
	t.Helper()
	peer := topology.Devices[1]
	peer.Ports = slices.Clone(peer.Ports)
	peer.ID = mustID(t)
	peer.Name = name
	for index := range peer.Ports {
		peer.Ports[index].ID = mustID(t)
		peer.Ports[index].DeviceID = peer.ID
	}
	topology.Devices = append(topology.Devices, peer)
	return peer.ID
}
