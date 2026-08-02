package model

import (
	"fmt"
	"time"
)

// NewDemo creates a representative network used for first-run bootstrapping.
func NewDemo() (Topology, error) {
	topologyID, err := NewID()
	if err != nil {
		return Topology{}, err
	}
	now := time.Now().UTC()
	topology := Topology{
		ID:   topologyID,
		Name: "Vienna Core Rack",
		VLANs: []VLAN{
			{ID: 1, Name: "Native", ColorHex: "#8a9ba8", Description: "Default untagged network"},
			{ID: 10, Name: "Management", ColorHex: "#42d9c8", Description: "Infrastructure management"},
			{ID: 20, Name: "Users", ColorHex: "#55a7ff", Description: "Corporate clients"},
			{ID: 30, Name: "Guest", ColorHex: "#f0b35a", Description: "Isolated guest access"},
		},
		Devices:   []Device{},
		Links:     []Link{},
		CreatedAt: now,
		UpdatedAt: now,
	}

	devices := []struct {
		name     string
		category DeviceCategory
		model    string
		x, y     float64
		ports    int
		color    string
		hasSFP   bool
	}{
		{name: "ISP HANDOFF", category: DeviceCategoryModem, model: "Carrier NID", x: 90, y: 90, ports: 4, color: "#24394a"},
		{name: "EDGE FIREWALL", category: DeviceCategoryFirewall, model: "NGFW 2200", x: 90, y: 260, ports: 8, color: "#51312b", hasSFP: true},
		{name: "CORE SWITCH A", category: DeviceCategorySwitch, model: "S5248F", x: 90, y: 430, ports: 24, color: "#203b3a", hasSFP: true},
		{name: "CORE SWITCH B", category: DeviceCategorySwitch, model: "S5248F", x: 90, y: 600, ports: 24, color: "#203b3a", hasSFP: true},
	}
	for _, definition := range devices {
		device, createErr := newDemoDevice(
			definition.name,
			definition.category,
			definition.model,
			definition.x,
			definition.y,
			definition.ports,
			definition.color,
			definition.hasSFP,
		)
		if createErr != nil {
			return Topology{}, createErr
		}
		topology.Devices = append(topology.Devices, device)
	}

	pairs := [][2]Port{
		{topology.Devices[0].Ports[0], topology.Devices[1].Ports[0]},
		{topology.Devices[1].Ports[1], topology.Devices[2].Ports[0]},
		{topology.Devices[2].Ports[1], topology.Devices[3].Ports[0]},
	}
	for index, pair := range pairs {
		linkID, createErr := NewID()
		if createErr != nil {
			return Topology{}, createErr
		}
		vlans := []int{1}
		primary := 1
		if index > 0 {
			vlans = []int{1, 10, 20, 30}
		}
		topology.Links = append(topology.Links, Link{
			ID:             linkID,
			SourceDeviceID: pair[0].DeviceID,
			SourcePortID:   pair[0].ID,
			TargetDeviceID: pair[1].DeviceID,
			TargetPortID:   pair[1].ID,
			CableType:      "CAT6A",
			VLANIDs:        vlans,
			PrimaryVLAN:    primary,
			Notes:          "Demo uplink",
		})
	}
	topology.Normalize()
	if err := topology.Validate(); err != nil {
		return Topology{}, fmt.Errorf("validating demo: %w", err)
	}
	return topology, nil
}

func newDemoDevice(
	name string,
	category DeviceCategory,
	deviceModel string,
	x float64,
	y float64,
	portCount int,
	color string,
	hasSFP bool,
) (Device, error) {
	deviceID, err := NewID()
	if err != nil {
		return Device{}, err
	}
	ports := make([]Port, 0, portCount)
	for index := range portCount {
		portID, createErr := NewID()
		if createErr != nil {
			return Device{}, createErr
		}
		mode := PortModeAccess
		allowed := []int{}
		isTrunkPort := index < 2 && category != DeviceCategoryModem
		if category == DeviceCategoryFirewall && index == 0 {
			isTrunkPort = false
		}
		if isTrunkPort {
			mode = PortModeTrunk
			allowed = []int{10, 20, 30}
		}
		ports = append(ports, Port{
			ID:           portID,
			DeviceID:     deviceID,
			PortIndex:    index + 1,
			Label:        fmt.Sprintf("%02d", index+1),
			Type:         PortTypeRJ451G,
			Mode:         mode,
			NativeVLAN:   1,
			AllowedVLANs: allowed,
			SpeedMbps:    1000,
			IsPoE:        category == DeviceCategorySwitch && index >= 4,
			Status:       "up",
		})
	}
	rows := 2
	if portCount <= 8 {
		rows = 1
	}
	return Device{
		ID:        deviceID,
		Name:      name,
		Category:  category,
		Model:     deviceModel,
		PositionX: x,
		PositionY: y,
		Faceplate: FaceplateSpec{
			UnitsU:       1,
			TotalPorts:   portCount,
			Rows:         rows,
			PortSpacingX: 23,
			PortSpacingY: 29,
			VendorColor:  color,
			HasSFPSlots:  hasSFP,
		},
		Ports: ports,
	}, nil
}
