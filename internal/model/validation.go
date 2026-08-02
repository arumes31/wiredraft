package model

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
)

var (
	colorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	idPattern    = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
)

// Validate checks the complete topology aggregate and all cross-references.
func (t Topology) Validate() error {
	if !idPattern.MatchString(t.ID) {
		return errors.New("topology id must be a version 4 uuid")
	}
	if strings.TrimSpace(t.Name) == "" || len(t.Name) > 120 {
		return errors.New("topology name must contain 1 to 120 characters")
	}
	if t.CreatedAt.IsZero() || t.UpdatedAt.IsZero() {
		return errors.New("topology timestamps must be set")
	}

	vlanIDs := make(map[int]struct{}, len(t.VLANs))
	for _, vlan := range t.VLANs {
		if err := vlan.Validate(); err != nil {
			return fmt.Errorf("validating vlan %d: %w", vlan.ID, err)
		}
		if _, exists := vlanIDs[vlan.ID]; exists {
			return fmt.Errorf("duplicate vlan id %d", vlan.ID)
		}
		vlanIDs[vlan.ID] = struct{}{}
	}

	deviceIDs := make(map[string]struct{}, len(t.Devices))
	ports := make(map[string]Port)
	for _, device := range t.Devices {
		if err := device.Validate(vlanIDs); err != nil {
			return fmt.Errorf("validating device %q: %w", device.Name, err)
		}
		if _, exists := deviceIDs[device.ID]; exists {
			return fmt.Errorf("duplicate device id %q", device.ID)
		}
		deviceIDs[device.ID] = struct{}{}
		for _, port := range device.Ports {
			if _, exists := ports[port.ID]; exists {
				return fmt.Errorf("duplicate port id %q", port.ID)
			}
			ports[port.ID] = port
		}
	}

	linkIDs := make(map[string]struct{}, len(t.Links))
	occupiedPorts := make(map[string]string, len(t.Links)*2)
	for _, link := range t.Links {
		if err := link.Validate(deviceIDs, ports, vlanIDs); err != nil {
			return fmt.Errorf("validating link %q: %w", link.ID, err)
		}
		if _, exists := linkIDs[link.ID]; exists {
			return fmt.Errorf("duplicate link id %q", link.ID)
		}
		linkIDs[link.ID] = struct{}{}
		for _, portID := range []string{link.SourcePortID, link.TargetPortID} {
			if existing, exists := occupiedPorts[portID]; exists {
				return fmt.Errorf("port %q is occupied by links %q and %q", portID, existing, link.ID)
			}
			occupiedPorts[portID] = link.ID
		}
	}
	return nil
}

// Validate checks a device and each of its ports.
func (d Device) Validate(vlanIDs map[int]struct{}) error {
	if !idPattern.MatchString(d.ID) {
		return errors.New("device id must be a version 4 uuid")
	}
	if strings.TrimSpace(d.Name) == "" || len(d.Name) > 120 {
		return errors.New("device name must contain 1 to 120 characters")
	}
	if !slices.Contains(validDeviceCategories, d.Category) {
		return fmt.Errorf("unknown category %q", d.Category)
	}
	if d.Faceplate.UnitsU < 1 || d.Faceplate.UnitsU > 12 {
		return errors.New("faceplate units must be between 1 and 12")
	}
	if d.Faceplate.Rows < 1 || d.Faceplate.Rows > 4 {
		return errors.New("faceplate rows must be between 1 and 4")
	}
	if !colorPattern.MatchString(d.Faceplate.VendorColor) {
		return errors.New("vendor color must be a six-digit hex color")
	}
	for _, port := range d.Ports {
		if err := port.Validate(d.ID, vlanIDs); err != nil {
			return fmt.Errorf("validating port %q: %w", port.Label, err)
		}
	}
	return nil
}

// Validate checks a physical port configuration.
func (p Port) Validate(deviceID string, vlanIDs map[int]struct{}) error {
	if !idPattern.MatchString(p.ID) {
		return errors.New("port id must be a version 4 uuid")
	}
	if p.DeviceID != deviceID {
		return errors.New("port device id does not match its parent")
	}
	if p.PortIndex < 1 {
		return errors.New("port index must be positive")
	}
	if strings.TrimSpace(p.Label) == "" || len(p.Label) > 80 {
		return errors.New("port label must contain 1 to 80 characters")
	}
	if !slices.Contains(validPortTypes, p.Type) {
		return fmt.Errorf("unknown port type %q", p.Type)
	}
	if !slices.Contains(validPortModes, p.Mode) {
		return fmt.Errorf("unknown port mode %q", p.Mode)
	}
	if p.SpeedMbps < 0 || p.SpeedMbps > 400000 {
		return errors.New("port speed must be between 0 and 400000 mbps")
	}
	if len(p.Group) > 40 {
		return errors.New("port group must not exceed 40 characters")
	}
	hasCustomPosition := p.FaceplateX != 0 || p.FaceplateY != 0
	if hasCustomPosition {
		isXValid := p.FaceplateX >= 0.02 && p.FaceplateX <= 0.98
		isYValid := p.FaceplateY >= 0.08 && p.FaceplateY <= 0.92
		if !isXValid || !isYValid {
			return errors.New("faceplate port position must be inside the chassis")
		}
	}
	if p.Mode != PortModeUnconfigured {
		if _, exists := vlanIDs[p.NativeVLAN]; !exists {
			return fmt.Errorf("native vlan %d does not exist", p.NativeVLAN)
		}
	}
	for _, vlanID := range p.AllowedVLANs {
		if _, exists := vlanIDs[vlanID]; !exists {
			return fmt.Errorf("allowed vlan %d does not exist", vlanID)
		}
	}
	return nil
}

// Validate checks a cable's endpoint and VLAN references.
func (l Link) Validate(deviceIDs map[string]struct{}, ports map[string]Port, vlanIDs map[int]struct{}) error {
	if !idPattern.MatchString(l.ID) {
		return errors.New("link id must be a version 4 uuid")
	}
	if l.SourcePortID == l.TargetPortID {
		return errors.New("link endpoints must be different ports")
	}
	if _, exists := deviceIDs[l.SourceDeviceID]; !exists {
		return errors.New("source device does not exist")
	}
	if _, exists := deviceIDs[l.TargetDeviceID]; !exists {
		return errors.New("target device does not exist")
	}
	source, exists := ports[l.SourcePortID]
	if !exists || source.DeviceID != l.SourceDeviceID {
		return errors.New("source port does not belong to source device")
	}
	target, exists := ports[l.TargetPortID]
	if !exists || target.DeviceID != l.TargetDeviceID {
		return errors.New("target port does not belong to target device")
	}
	if strings.TrimSpace(l.CableType) == "" || len(l.CableType) > 80 {
		return errors.New("cable type must contain 1 to 80 characters")
	}
	if len(l.Notes) > 1000 {
		return errors.New("link notes must not exceed 1000 characters")
	}
	if l.PrimaryVLAN != 0 {
		if _, exists := vlanIDs[l.PrimaryVLAN]; !exists {
			return fmt.Errorf("primary vlan %d does not exist", l.PrimaryVLAN)
		}
	}
	for _, vlanID := range l.VLANIDs {
		if _, exists := vlanIDs[vlanID]; !exists {
			return fmt.Errorf("link vlan %d does not exist", vlanID)
		}
	}
	return nil
}

// Validate checks VLAN ranges and display properties.
func (v VLAN) Validate() error {
	if v.ID < 1 || v.ID > 4094 {
		return errors.New("vlan id must be between 1 and 4094")
	}
	if strings.TrimSpace(v.Name) == "" || len(v.Name) > 80 {
		return errors.New("vlan name must contain 1 to 80 characters")
	}
	if !colorPattern.MatchString(v.ColorHex) {
		return errors.New("vlan color must be a six-digit hex color")
	}
	if len(v.Description) > 500 {
		return errors.New("vlan description must not exceed 500 characters")
	}
	return nil
}

var validDeviceCategories = []DeviceCategory{
	DeviceCategoryModem,
	DeviceCategoryRouter,
	DeviceCategorySwitch,
	DeviceCategoryFirewall,
	DeviceCategoryPatchPanel,
	DeviceCategoryServer,
	DeviceCategoryAccessPoint,
}

var validPortTypes = []PortType{
	PortTypeRJ451G,
	PortTypeRJ4510G,
	PortTypeSFP1G,
	PortTypeSFPPlus10G,
	PortTypeSFP2825G,
	PortTypeSFP5650G,
	PortTypeQSFP28100G,
	PortTypeConsole,
	PortTypePower,
}

var validPortModes = []PortMode{
	PortModeAccess,
	PortModeTrunk,
	PortModeHybrid,
	PortModeUnconfigured,
}
