package model

import (
	"slices"
	"strconv"
	"testing"
)

func TestSimulateSTPSelectsRootBlocksCycleAndBuildsPaths(t *testing.T) {
	t.Parallel()
	root := stpTestSwitch(t, "CORE ROOT", 2)
	root.STPPriority = 4096
	accessA := stpTestSwitch(t, "ACCESS A", 2)
	accessB := stpTestSwitch(t, "ACCESS B", 2)
	topology := stpTestTopology(
		[]Device{root, accessA, accessB},
		[]Link{
			newTestLink(t, root.Ports[0], accessA.Ports[0]),
			newTestLink(t, accessA.Ports[1], accessB.Ports[0]),
			newTestLink(t, accessB.Ports[1], root.Ports[1]),
		},
	)

	analysis := Analyze(topology)
	if len(analysis.STP) != 1 {
		t.Fatalf("Analyze().STP = %#v, want one spanning-tree domain", analysis.STP)
	}
	instance := analysis.STP[0]
	if instance.RootBridgeID != root.ID || instance.RootName != root.Name {
		t.Fatalf("root = %q (%q), want %q (%q)", instance.RootBridgeID, instance.RootName, root.ID, root.Name)
	}
	blocked := physicalPortsWithRole(instance.Ports, STPRoleBlocked)
	if len(blocked) != 1 {
		t.Fatalf("blocked ports = %#v, want one physical blocked endpoint", blocked)
	}
	if len(analysis.Loops) != 1 || analysis.Loops[0].VLANID != 1 {
		t.Fatalf("Analyze().Loops = %#v, want one VLAN 1 switching cycle", analysis.Loops)
	}
	if !slices.ContainsFunc(instance.Paths, func(path STPPath) bool {
		return path.BridgeID == accessB.ID && path.BridgeIDs[len(path.BridgeIDs)-1] == root.ID && len(path.LinkIDs) > 0
	}) {
		t.Fatalf("paths = %#v, want convergence path from ACCESS B to root", instance.Paths)
	}
}

func TestSimulateSTPCollapsesBundledPhysicalMembers(t *testing.T) {
	t.Parallel()
	for _, mode := range []LinkGroupMode{LinkGroupModeTrunk, LinkGroupModeLACP, LinkGroupModeMCLAG} {
		mode := mode
		t.Run(string(mode), func(t *testing.T) {
			t.Parallel()
			left := stpTestSwitch(t, "LEFT", 2)
			right := stpTestSwitch(t, "RIGHT", 2)
			links := []Link{
				newTestLink(t, left.Ports[0], right.Ports[0]),
				newTestLink(t, left.Ports[1], right.Ports[1]),
			}
			groupID := mustID(t)
			topology := stpTestTopology([]Device{left, right}, links)
			topology.LinkGroups = []LinkGroup{{
				ID: groupID, Name: "UPLINK BUNDLE", Mode: mode, LinkIDs: []string{links[0].ID, links[1].ID},
			}}

			instances := SimulateSTP(topology, stpPortMap(topology))
			if len(instances) != 1 {
				t.Fatalf("SimulateSTP() domains = %d, want 1", len(instances))
			}
			if blocked := physicalPortsWithRole(instances[0].Ports, STPRoleBlocked); len(blocked) != 0 {
				t.Fatalf("blocked ports = %#v, bundled members must be one logical edge", blocked)
			}
			if len(instances[0].Ports) != 4 {
				t.Fatalf("physical port states = %d, want all four bundle endpoints", len(instances[0].Ports))
			}
			if slices.ContainsFunc(instances[0].Ports, func(port STPPortState) bool { return port.GroupID != groupID }) {
				t.Fatalf("port states = %#v, want group ID on every physical member", instances[0].Ports)
			}
		})
	}
}

func TestSimulateSTPCollapsesLogicalSwitchSystemForMCLAG(t *testing.T) {
	t.Parallel()
	peerA := stpTestSwitch(t, "VSF MEMBER 1", 2)
	peerB := stpTestSwitch(t, "VSF MEMBER 2", 2)
	access := stpTestSwitch(t, "ACCESS", 2)
	links := []Link{
		newTestLink(t, peerA.Ports[0], access.Ports[0]),
		newTestLink(t, peerB.Ports[0], access.Ports[1]),
		newTestLink(t, peerA.Ports[1], peerB.Ports[1]),
	}
	topology := stpTestTopology([]Device{peerA, peerB, access}, links)
	systemID := mustID(t)
	groupID := mustID(t)
	topology.SwitchSystems = []SwitchSystem{{
		ID: systemID, Name: "CORE VSF", Mode: SwitchSystemModeVSF, DeviceIDs: []string{peerA.ID, peerB.ID},
	}}
	topology.LinkGroups = []LinkGroup{{
		ID: groupID, Name: "MC-LAG DOWNLINK", Mode: LinkGroupModeMCLAG, LinkIDs: []string{links[0].ID, links[1].ID},
	}}

	analysis := Analyze(topology)
	if len(analysis.STP) != 1 {
		t.Fatalf("Analyze().STP = %#v, want one logical domain", analysis.STP)
	}
	if len(analysis.STP[0].Bridges) != 2 {
		t.Fatalf("bridges = %#v, want VSF members collapsed into one logical bridge", analysis.STP[0].Bridges)
	}
	if len(physicalPortsWithRole(analysis.STP[0].Ports, STPRoleBlocked)) != 0 || len(analysis.Loops) != 0 {
		t.Fatalf("analysis = %#v, logical peer bundle must not create a false cycle", analysis)
	}
	if !slices.ContainsFunc(analysis.STP[0].Bridges, func(bridge STPBridgeState) bool {
		return bridge.BridgeID == systemID && len(bridge.DeviceIDs) == 2 &&
			slices.Contains(bridge.DeviceIDs, peerA.ID) && slices.Contains(bridge.DeviceIDs, peerB.ID)
	}) {
		t.Fatalf("bridges = %#v, want physical member inventory on logical bridge", analysis.STP[0].Bridges)
	}
}

func TestSimulateSTPUsesOnlyPrimaryFailoverMember(t *testing.T) {
	t.Parallel()
	left := stpTestSwitch(t, "LEFT", 2)
	right := stpTestSwitch(t, "RIGHT", 2)
	links := []Link{
		newTestLink(t, left.Ports[0], right.Ports[0]),
		newTestLink(t, left.Ports[1], right.Ports[1]),
	}
	topology := stpTestTopology([]Device{left, right}, links)
	topology.LinkGroups = []LinkGroup{{
		ID: mustID(t), Name: "FAILOVER", Mode: LinkGroupModeFailover,
		LinkIDs: []string{links[0].ID, links[1].ID}, PrimaryLinkID: links[0].ID,
	}}

	instances := SimulateSTP(topology, stpPortMap(topology))
	if len(instances) != 1 || len(instances[0].Ports) != 2 {
		t.Fatalf("instances = %#v, want only active failover member in forwarding topology", instances)
	}
	if slices.ContainsFunc(instances[0].Ports, func(port STPPortState) bool { return port.LinkID == links[1].ID }) {
		t.Fatalf("ports = %#v, backup member must not participate until active", instances[0].Ports)
	}
}

func TestSimulateSTPIncludesIsolatedBridgeDomain(t *testing.T) {
	t.Parallel()
	switchDevice := stpTestSwitch(t, "ISOLATED", 1)
	topology := stpTestTopology([]Device{switchDevice}, nil)
	instances := SimulateSTP(topology, stpPortMap(topology))
	if len(instances) != 1 || instances[0].RootBridgeID != switchDevice.ID || len(instances[0].Bridges) != 1 {
		t.Fatalf("SimulateSTP() = %#v, want isolated switch as its own root domain", instances)
	}
}

func stpTestSwitch(t *testing.T, name string, portCount int) Device {
	t.Helper()
	deviceID := mustID(t)
	ports := make([]Port, 0, portCount)
	for index := range portCount {
		ports = append(ports, Port{
			ID: mustID(t), DeviceID: deviceID, PortIndex: index + 1, Label: strconv.Itoa(index + 1),
			Type: PortTypeSFPPlus10G, Mode: PortModeTrunk, NativeVLAN: 1,
			AllowedVLANs: []int{10}, SpeedMbps: 10000, Status: "up",
		})
	}
	return Device{
		ID: deviceID, Name: name, Category: DeviceCategorySwitch, Model: "STP fixture",
		Faceplate: FaceplateSpec{UnitsU: 1, TotalPorts: portCount, Rows: 1, PortSpacingX: 20, PortSpacingY: 20, VendorColor: "#203b3a"},
		Ports:     ports,
	}
}

func stpTestTopology(devices []Device, links []Link) Topology {
	return Topology{
		Name: "STP fixture", Devices: devices, Links: links,
		VLANs: []VLAN{{ID: 1, Name: "Native", ColorHex: "#8a9ba8"}},
	}
}

func stpPortMap(topology Topology) map[string]Port {
	ports := make(map[string]Port)
	for _, device := range topology.Devices {
		for _, port := range device.Ports {
			ports[port.ID] = port
		}
	}
	return ports
}

func physicalPortsWithRole(ports []STPPortState, role string) []STPPortState {
	return slices.DeleteFunc(slices.Clone(ports), func(port STPPortState) bool { return port.Role != role })
}
