package model

import (
	"fmt"
	"strings"
	"testing"
)

func TestValidationBoundaries(t *testing.T) {
	t.Parallel()
	vlanIDs := map[int]struct{}{1: {}, 4094: {}}
	deviceIDs := map[string]struct{}{"00000000-0000-4000-8000-000000000010": {}}
	port := Port{
		ID: "00000000-0000-4000-8000-000000000011", DeviceID: "00000000-0000-4000-8000-000000000010",
		PortIndex: 1, Label: "1", Type: PortTypeRJ451G, Mode: PortModeAccess, NativeVLAN: 1,
		AllowedVLANs: []int{}, SpeedMbps: 1000, Status: PortStatusDown,
	}
	targetPort := port
	targetPort.ID = fixtureUUID(13)
	targetPort.PortIndex = 2
	ports := map[string]Port{port.ID: port, targetPort.ID: targetPort}

	tests := []struct {
		name string
		run  func() error
	}{
		{"rack minimum height", func() error { return (Rack{ID: fixtureUUID(1), Name: "R", HeightU: 6, Color: "#000000"}).Validate() }},
		{"rack below minimum", func() error { return (Rack{ID: fixtureUUID(1), Name: "R", HeightU: 5, Color: "#000000"}).Validate() }},
		{"vlan maximum id", func() error { return (VLAN{ID: 4094, Name: "V", ColorHex: "#abcdef"}).Validate() }},
		{"vlan reserved id", func() error { return (VLAN{ID: 4095, Name: "V", ColorHex: "#abcdef"}).Validate() }},
		{"port maximum speed", func() error {
			candidate := port
			candidate.SpeedMbps = 800000
			return candidate.Validate(candidate.DeviceID, vlanIDs)
		}},
		{"port above maximum speed", func() error {
			candidate := port
			candidate.SpeedMbps = 800001
			return candidate.Validate(candidate.DeviceID, vlanIDs)
		}},
		{"port faceplate edge", func() error {
			candidate := port
			candidate.FaceplateX = .98
			candidate.FaceplateY = .92
			return candidate.Validate(candidate.DeviceID, vlanIDs)
		}},
		{"port outside faceplate", func() error {
			candidate := port
			candidate.FaceplateX = .99
			candidate.FaceplateY = .5
			return candidate.Validate(candidate.DeviceID, vlanIDs)
		}},
		{"device maximum rows", func() error { return validationDevice(port, 4).Validate(vlanIDs) }},
		{"device too many rows", func() error { return validationDevice(port, 5).Validate(vlanIDs) }},
		{"link valid primary vlan", func() error { return validationLink(port).Validate(deviceIDs, ports, vlanIDs) }},
		{"link missing target", func() error {
			candidate := validationLink(port)
			candidate.TargetPortID = fixtureUUID(99)
			return candidate.Validate(deviceIDs, ports, vlanIDs)
		}},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			err := test.run()
			wantError := strings.Contains(test.name, "below") || strings.Contains(test.name, "above") ||
				strings.Contains(test.name, "outside") || strings.Contains(test.name, "too many") || strings.Contains(test.name, "missing") ||
				strings.Contains(test.name, "reserved")
			if (err != nil) != wantError {
				t.Fatalf("error = %v, wantError = %v", err, wantError)
			}
		})
	}
}

func TestAggregateValidatorsRejectDuplicateMembers(t *testing.T) {
	t.Parallel()
	demo, err := NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	linkIDs := map[string]struct{}{demo.Links[0].ID: {}, demo.Links[1].ID: {}}
	for name, validate := range map[string]func() error{
		"link group": func() error {
			return (LinkGroup{ID: fixtureUUID(20), Name: "G", Mode: LinkGroupModeLACP, LinkIDs: []string{demo.Links[0].ID, demo.Links[0].ID}}).Validate(linkIDs)
		},
		"switch system": func() error {
			switches := validationMembers(DeviceCategorySwitch)
			ids := map[string]struct{}{switches[0].ID: {}, switches[1].ID: {}}
			return (SwitchSystem{ID: fixtureUUID(21), Name: "S", Mode: SwitchSystemModeStack, DeviceIDs: []string{switches[0].ID, switches[0].ID}}).Validate(ids, switches)
		},
		"firewall cluster": func() error {
			firewalls := validationMembers(DeviceCategoryFirewall)
			ids := map[string]struct{}{firewalls[0].ID: {}, firewalls[1].ID: {}}
			return (FirewallCluster{ID: fixtureUUID(22), Name: "F", Mode: FirewallClusterModeActiveActive, DeviceIDs: []string{firewalls[0].ID, firewalls[0].ID}}).Validate(ids, firewalls)
		},
	} {
		if err := validate(); err == nil {
			t.Errorf("%s accepted duplicate members", name)
		}
	}
}

func TestTopologyValidationRejectsCrossReferenceAndPlacementEdges(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		mutate func(*Topology)
	}{
		{"duplicate VLAN", func(topology *Topology) { topology.VLANs = append(topology.VLANs, topology.VLANs[0]) }},
		{"duplicate device", func(topology *Topology) { topology.Devices = append(topology.Devices, topology.Devices[0]) }},
		{"occupied port", func(topology *Topology) {
			duplicate := topology.Links[0]
			duplicate.ID = fixtureUUID(88)
			topology.Links = append(topology.Links, duplicate)
		}},
		{"unknown rack", func(topology *Topology) {
			topology.Devices[0].RackID = fixtureUUID(87)
			topology.Devices[0].RackUnit = 1
		}},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			topology, err := NewDemo()
			if err != nil {
				t.Fatal(err)
			}
			test.mutate(&topology)
			if err := topology.Validate(); err == nil {
				t.Fatal("Validate() succeeded, want cross-reference error")
			}
		})
	}
}

func validationDevice(port Port, rows int) Device {
	return Device{
		ID: port.DeviceID, Name: "D", Category: DeviceCategorySwitch,
		Faceplate: FaceplateSpec{UnitsU: 1, Rows: rows, VendorColor: "#000000"}, Ports: []Port{port},
	}
}

func validationLink(port Port) Link {
	return Link{
		ID: fixtureUUID(12), SourceDeviceID: port.DeviceID, SourcePortID: port.ID,
		TargetDeviceID: port.DeviceID, TargetPortID: fixtureUUID(13), CableType: "CAT6A", PrimaryVLAN: 1,
	}
}

func validationMembers(category DeviceCategory) []Device {
	return []Device{{ID: fixtureUUID(30), Category: category}, {ID: fixtureUUID(31), Category: category}}
}

func fixtureUUID(value int) string {
	return fmt.Sprintf("00000000-0000-4000-8000-%012x", value)
}
