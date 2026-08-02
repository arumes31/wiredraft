// Package model defines network topology aggregates and their invariants.
package model

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"time"
)

// DeviceCategory identifies the hardware role rendered on a rack faceplate.
type DeviceCategory string

const (
	DeviceCategoryModem       DeviceCategory = "Modem"
	DeviceCategoryRouter      DeviceCategory = "Router"
	DeviceCategorySwitch      DeviceCategory = "Switch"
	DeviceCategoryFirewall    DeviceCategory = "Firewall"
	DeviceCategoryPatchPanel  DeviceCategory = "PatchPanel"
	DeviceCategoryServer      DeviceCategory = "Server"
	DeviceCategoryAccessPoint DeviceCategory = "AccessPoint"
)

// PortType identifies a physical connector and its nominal media rate.
type PortType string

const (
	PortTypeRJ451G     PortType = "RJ45_1G"
	PortTypeRJ4510G    PortType = "RJ45_10G"
	PortTypeSFP1G      PortType = "SFP_1G"
	PortTypeSFPPlus10G PortType = "SFP_PLUS_10G"
	PortTypeSFP2825G   PortType = "SFP28_25G"
	PortTypeSFP5650G   PortType = "SFP56_50G"
	PortTypeQSFP28100G PortType = "QSFP28_100G"
	PortTypeConsole    PortType = "Console"
	PortTypePower      PortType = "Power"
)

// PortMode identifies how a port carries VLAN traffic.
type PortMode string

const (
	PortModeAccess       PortMode = "Access"
	PortModeTrunk        PortMode = "Trunk"
	PortModeHybrid       PortMode = "Hybrid"
	PortModeUnconfigured PortMode = "Unconfigured"
)

// Port is a physical interface on a device.
type Port struct {
	ID           string   `json:"id"`
	DeviceID     string   `json:"deviceId"`
	PortIndex    int      `json:"portIndex"`
	Label        string   `json:"label"`
	Type         PortType `json:"type"`
	Mode         PortMode `json:"mode"`
	NativeVLAN   int      `json:"nativeVlan"`
	AllowedVLANs []int    `json:"allowedVlans"`
	SpeedMbps    int      `json:"speedMbps"`
	IsPoE        bool     `json:"isPoe"`
	Status       string   `json:"status"`
	Group        string   `json:"group,omitempty"`
	FaceplateX   float64  `json:"faceplateX,omitempty"`
	FaceplateY   float64  `json:"faceplateY,omitempty"`
}

// FaceplateSpec controls physical device rendering.
type FaceplateSpec struct {
	UnitsU       int     `json:"unitsU"`
	TotalPorts   int     `json:"totalPorts"`
	Rows         int     `json:"rows"`
	PortSpacingX float64 `json:"portSpacingX"`
	PortSpacingY float64 `json:"portSpacingY"`
	VendorColor  string  `json:"vendorColor"`
	HasSFPSlots  bool    `json:"hasSfpSlots"`
	Vendor       string  `json:"vendor,omitempty"`
	Layout       string  `json:"layout,omitempty"`
}

// Device is a rack-mounted or edge network appliance.
type Device struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Category  DeviceCategory `json:"category"`
	Model     string         `json:"model"`
	PositionX float64        `json:"positionX"`
	PositionY float64        `json:"positionY"`
	Faceplate FaceplateSpec  `json:"faceplate"`
	Ports     []Port         `json:"ports"`
}

// Link connects exactly two physical ports.
type Link struct {
	ID             string `json:"id"`
	SourceDeviceID string `json:"sourceDeviceId"`
	SourcePortID   string `json:"sourcePortId"`
	TargetDeviceID string `json:"targetDeviceId"`
	TargetPortID   string `json:"targetPortId"`
	CableType      string `json:"cableType"`
	VLANIDs        []int  `json:"vlanIds"`
	PrimaryVLAN    int    `json:"primaryVlan"`
	Notes          string `json:"notes"`
}

// VLAN describes a layer-two broadcast domain and its diagram color.
type VLAN struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	ColorHex    string `json:"colorHex"`
	Description string `json:"description"`
}

// Topology is the persisted root aggregate.
type Topology struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Devices   []Device  `json:"devices"`
	Links     []Link    `json:"links"`
	VLANs     []VLAN    `json:"vlans"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Summary is the compact representation returned by topology listings.
type Summary struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	DeviceCount int       `json:"deviceCount"`
	LinkCount   int       `json:"linkCount"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// NewID returns a random RFC 4122 version 4 UUID without an external dependency.
func NewID() (string, error) {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", fmt.Errorf("generating id: %w", err)
	}
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80
	encoded := make([]byte, 36)
	hex.Encode(encoded[0:8], raw[0:4])
	encoded[8] = '-'
	hex.Encode(encoded[9:13], raw[4:6])
	encoded[13] = '-'
	hex.Encode(encoded[14:18], raw[6:8])
	encoded[18] = '-'
	hex.Encode(encoded[19:23], raw[8:10])
	encoded[23] = '-'
	hex.Encode(encoded[24:36], raw[10:16])
	return string(encoded), nil
}

// Normalize initializes slices and canonicalizes derived port fields.
func (t *Topology) Normalize() {
	if t.Devices == nil {
		t.Devices = []Device{}
	}
	if t.Links == nil {
		t.Links = []Link{}
	}
	if t.VLANs == nil {
		t.VLANs = []VLAN{}
	}
	for deviceIndex := range t.Devices {
		device := &t.Devices[deviceIndex]
		if device.Ports == nil {
			device.Ports = []Port{}
		}
		device.Faceplate.TotalPorts = len(device.Ports)
		for portIndex := range device.Ports {
			port := &device.Ports[portIndex]
			port.DeviceID = device.ID
			port.PortIndex = portIndex + 1
			if port.AllowedVLANs == nil {
				port.AllowedVLANs = []int{}
			}
			slices.Sort(port.AllowedVLANs)
			port.AllowedVLANs = slices.Compact(port.AllowedVLANs)
		}
	}
	for linkIndex := range t.Links {
		link := &t.Links[linkIndex]
		if link.VLANIDs == nil {
			link.VLANIDs = []int{}
		}
		slices.Sort(link.VLANIDs)
		link.VLANIDs = slices.Compact(link.VLANIDs)
	}
}

// Clone returns a validated defensive copy of the topology.
func (t Topology) Clone() (Topology, error) {
	data, err := json.Marshal(t)
	if err != nil {
		return Topology{}, fmt.Errorf("cloning topology: %w", err)
	}
	var clone Topology
	if err := json.Unmarshal(data, &clone); err != nil {
		return Topology{}, fmt.Errorf("decoding topology clone: %w", err)
	}
	return clone, nil
}

// MarshalJSON rejects invalid aggregates before they can be persisted.
func (t Topology) MarshalJSON() ([]byte, error) {
	copy := t
	copy.Normalize()
	if err := copy.Validate(); err != nil {
		return nil, err
	}
	type topologyAlias Topology
	return json.Marshal(topologyAlias(copy))
}

// UnmarshalJSON rejects unknown fields and invalid persisted aggregates.
func (t *Topology) UnmarshalJSON(data []byte) error {
	type topologyAlias Topology
	var decoded topologyAlias
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&decoded); err != nil {
		return fmt.Errorf("decoding topology: %w", err)
	}
	*t = Topology(decoded)
	t.Normalize()
	return t.Validate()
}
