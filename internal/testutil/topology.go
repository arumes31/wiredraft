// Package testutil provides deterministic, validated topology fixtures for tests,
// benchmarks, fuzz seeds, and external load tools.
package testutil

import (
	"errors"
	"fmt"
	"time"

	"netdiagram/internal/model"
)

// TopologyOptions controls the size of a generated linear switching topology.
type TopologyOptions struct {
	DeviceCount    int
	PortsPerDevice int
	VLANCount      int
}

// GenerateTopology builds the same valid topology for the same options.
func GenerateTopology(options TopologyOptions) (model.Topology, error) {
	if options.DeviceCount < 1 {
		return model.Topology{}, errors.New("device count must be positive")
	}
	if options.PortsPerDevice < 2 || options.PortsPerDevice > 96 {
		return model.Topology{}, errors.New("ports per device must be between 2 and 96")
	}
	if options.VLANCount < 1 || options.VLANCount > 256 {
		return model.Topology{}, errors.New("vlan count must be between 1 and 256")
	}

	const topologyIDOffset = 1
	const deviceIDOffset = 1000
	const portIDOffset = 100000
	const linkIDOffset = 900000
	now := time.Date(2025, time.January, 2, 3, 4, 5, 0, time.UTC)
	topology := model.Topology{
		ID:        fixtureID(topologyIDOffset),
		Name:      fmt.Sprintf("Generated %d-device topology", options.DeviceCount),
		CreatedAt: now,
		UpdatedAt: now,
		VLANs:     make([]model.VLAN, options.VLANCount),
		Devices:   make([]model.Device, options.DeviceCount),
		Links:     make([]model.Link, 0, options.DeviceCount-1),
	}
	for index := range topology.VLANs {
		vlanID := index + 1
		topology.VLANs[index] = model.VLAN{
			ID:          vlanID,
			Name:        fmt.Sprintf("Generated VLAN %d", vlanID),
			ColorHex:    fmt.Sprintf("#%06x", (0x224466+index*0x010101)&0xffffff),
			Description: "Deterministic quality fixture",
		}
	}
	for deviceIndex := range topology.Devices {
		deviceID := fixtureID(deviceIDOffset + deviceIndex)
		device := model.Device{
			ID:        deviceID,
			Name:      fmt.Sprintf("SW-%04d", deviceIndex+1),
			Category:  model.DeviceCategorySwitch,
			Model:     "Quality Fixture Switch",
			PositionX: float64(80 + deviceIndex%16*280),
			PositionY: float64(80 + deviceIndex/16*120),
			Faceplate: model.FaceplateSpec{
				UnitsU: 1, Rows: 2, PortSpacingX: 22, PortSpacingY: 26,
				VendorColor: "#223438", Vendor: "Fixture", Layout: "generic-switch",
			},
			Ports: make([]model.Port, options.PortsPerDevice),
		}
		for portIndex := range device.Ports {
			device.Ports[portIndex] = model.Port{
				ID:           fixtureID(portIDOffset + deviceIndex*options.PortsPerDevice + portIndex),
				DeviceID:     deviceID,
				PortIndex:    portIndex + 1,
				Label:        fmt.Sprintf("%d", portIndex+1),
				Type:         model.PortTypeRJ451G,
				Mode:         model.PortModeTrunk,
				NativeVLAN:   1,
				AllowedVLANs: generatedVLANIDs(options.VLANCount),
				SpeedMbps:    1000,
				Status:       model.PortStatusDown,
			}
		}
		topology.Devices[deviceIndex] = device
	}
	for deviceIndex := 0; deviceIndex+1 < options.DeviceCount; deviceIndex++ {
		source := &topology.Devices[deviceIndex]
		target := &topology.Devices[deviceIndex+1]
		source.Ports[1].Status = model.PortStatusUp
		target.Ports[0].Status = model.PortStatusUp
		topology.Links = append(topology.Links, model.Link{
			ID:             fixtureID(linkIDOffset + deviceIndex),
			SourceDeviceID: source.ID,
			SourcePortID:   source.Ports[1].ID,
			TargetDeviceID: target.ID,
			TargetPortID:   target.Ports[0].ID,
			CableType:      "CAT6A",
			VLANIDs:        generatedVLANIDs(options.VLANCount),
			PrimaryVLAN:    1,
		})
	}
	topology.Normalize()
	if err := topology.Validate(); err != nil {
		return model.Topology{}, fmt.Errorf("validating generated topology: %w", err)
	}
	return topology, nil
}

func fixtureID(value int) string {
	return fmt.Sprintf("00000000-0000-4000-8000-%012x", value)
}

func generatedVLANIDs(count int) []int {
	ids := make([]int, count)
	for index := range ids {
		ids[index] = index + 1
	}
	return ids
}
