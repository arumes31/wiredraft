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

// CommentAnchorKind identifies what a discussion is attached to.
type CommentAnchorKind string

const (
	CommentAnchorCanvas CommentAnchorKind = "canvas"
	CommentAnchorDevice CommentAnchorKind = "device"
	CommentAnchorLink   CommentAnchorKind = "link"
)

// DocumentationTargetKind identifies an object that owns an external document link.
type DocumentationTargetKind string

const (
	DocumentationTargetTopology DocumentationTargetKind = "topology"
	DocumentationTargetRack     DocumentationTargetKind = "rack"
	DocumentationTargetDevice   DocumentationTargetKind = "device"
	DocumentationTargetPort     DocumentationTargetKind = "port"
	DocumentationTargetLink     DocumentationTargetKind = "link"
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
	PortTypeRJ451G      PortType = "RJ45_1G"
	PortTypeRJ45MGIG    PortType = "RJ45_MGIG"
	PortTypeRJ4510G     PortType = "RJ45_10G"
	PortTypeDSLRJ11     PortType = "DSL_RJ11"
	PortTypeSFP1G       PortType = "SFP_1G"
	PortTypeSFPPlus10G  PortType = "SFP_PLUS_10G"
	PortTypeSFP2825G    PortType = "SFP28_25G"
	PortTypeSFP5650G    PortType = "SFP56_50G"
	PortTypeQSFPPlus40G PortType = "QSFP_PLUS_40G"
	PortTypeQSFP28100G  PortType = "QSFP28_100G"
	PortTypeQSFP56200G  PortType = "QSFP56_200G"
	PortTypeQSFPDD400G  PortType = "QSFP_DD_400G"
	PortTypeCFP100G     PortType = "CFP_100G"
	PortTypeCFP2100G    PortType = "CFP2_100G"
	PortTypeCFP4100G    PortType = "CFP4_100G"
	PortTypeOSFP800G    PortType = "OSFP_800G"
	PortTypeFiberLC     PortType = "FIBER_LC"
	PortTypeFiberSC     PortType = "FIBER_SC"
	PortTypeFiberMPO    PortType = "FIBER_MPO"
	PortTypeUSBMicro    PortType = "USB_MICRO_CONSOLE"
	PortTypeUSBC        PortType = "USB_C_CONSOLE"
	PortTypeStack       PortType = "Stack"
	PortTypeConsole     PortType = "Console"
	PortTypePower       PortType = "Power"
)

// PortMode identifies how a port carries VLAN traffic.
type PortMode string

const (
	PortModeAccess       PortMode = "Access"
	PortModeTrunk        PortMode = "Trunk"
	PortModeHybrid       PortMode = "Hybrid"
	PortModeUnconfigured PortMode = "Unconfigured"
)

// Physical port link-state values used by the API and faceplate renderer.
const (
	PortStatusUp   = "up"
	PortStatusDown = "down"
)

// LinkGroupMode identifies the logical relationship between physical links.
type LinkGroupMode string

const (
	LinkGroupModeTrunk    LinkGroupMode = "Trunk"
	LinkGroupModeLACP     LinkGroupMode = "LACP"
	LinkGroupModeMCLAG    LinkGroupMode = "MCLAG"
	LinkGroupModeFailover LinkGroupMode = "Failover"
)

// SwitchSystemMode identifies the technology that makes multiple physical
// switches operate as one logical unit.
type SwitchSystemMode string

const (
	SwitchSystemModeStack          SwitchSystemMode = "Stack"
	SwitchSystemModeVSF            SwitchSystemMode = "VSF"
	SwitchSystemModeMCLAG          SwitchSystemMode = "MCLAG"
	SwitchSystemModeStackWise      SwitchSystemMode = "StackWise"
	SwitchSystemModeVSS            SwitchSystemMode = "VSS"
	SwitchSystemModeVirtualChassis SwitchSystemMode = "VirtualChassis"
	SwitchSystemModeIRF            SwitchSystemMode = "IRF"
	SwitchSystemModeCustom         SwitchSystemMode = "Custom"
)

// FirewallClusterMode identifies how firewall members forward traffic.
type FirewallClusterMode string

const (
	FirewallClusterModeActiveActive  FirewallClusterMode = "ActiveActive"
	FirewallClusterModeActivePassive FirewallClusterMode = "ActivePassive"
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
	MediaType    string   `json:"mediaType,omitempty"`
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

// Rack is a movable whole-unit equipment enclosure on the topology canvas.
type Rack struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	PositionX float64 `json:"positionX"`
	PositionY float64 `json:"positionY"`
	HeightU   int     `json:"heightU"`
	Color     string  `json:"color"`
}

// DeviceLocation records organizational placement independently from canvas
// geometry and rack membership.
type DeviceLocation struct {
	Site     string `json:"site,omitempty"`
	Building string `json:"building,omitempty"`
	Floor    string `json:"floor,omitempty"`
	Room     string `json:"room,omitempty"`
	Rack     string `json:"rack,omitempty"`
	RackUnit int    `json:"rackUnit,omitempty"`
}

// Device is a rack-mounted or edge network appliance.
type Device struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Category     DeviceCategory `json:"category"`
	Model        string         `json:"model"`
	SerialNumber string         `json:"serialNumber,omitempty"`
	AssetTag     string         `json:"assetTag,omitempty"`
	Hostname     string         `json:"hostname,omitempty"`
	ManagementIP string         `json:"managementIp,omitempty"`
	Location     DeviceLocation `json:"location"`
	Owner        string         `json:"owner,omitempty"`
	STPPriority  int            `json:"stpPriority,omitempty"`
	PositionX    float64        `json:"positionX"`
	PositionY    float64        `json:"positionY"`
	RackID       string         `json:"rackId,omitempty"`
	RackUnit     int            `json:"rackUnit,omitempty"`
	Faceplate    FaceplateSpec  `json:"faceplate"`
	Ports        []Port         `json:"ports"`
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

// Annotation is a lightweight canvas note which remains independent from
// physical topology objects and therefore survives layout and catalog changes.
type Annotation struct {
	ID    string  `json:"id"`
	Type  string  `json:"type"`
	X1    float64 `json:"x1"`
	Y1    float64 `json:"y1"`
	X2    float64 `json:"x2,omitempty"`
	Y2    float64 `json:"y2,omitempty"`
	Text  string  `json:"text,omitempty"`
	Color string  `json:"color"`
}

// LinkGroup relates physical cables without changing their endpoints.
type LinkGroup struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	Mode          LinkGroupMode `json:"mode"`
	LinkIDs       []string      `json:"linkIds"`
	PrimaryLinkID string        `json:"primaryLinkId,omitempty"`
	Notes         string        `json:"notes"`
}

// SwitchSystem groups physical switch chassis into one logical inventory and
// topology unit while keeping every chassis and port independently addressable.
type SwitchSystem struct {
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Mode      SwitchSystemMode `json:"mode"`
	DeviceIDs []string         `json:"deviceIds"`
	Notes     string           `json:"notes"`
}

// FirewallCluster groups physical firewall appliances into one logical HA unit
// while keeping every member and interface independently addressable.
type FirewallCluster struct {
	ID             string              `json:"id"`
	Name           string              `json:"name"`
	Mode           FirewallClusterMode `json:"mode"`
	DeviceIDs      []string            `json:"deviceIds"`
	ActiveDeviceID string              `json:"activeDeviceId,omitempty"`
	Notes          string              `json:"notes"`
}

// VLAN describes a layer-two broadcast domain and its diagram color.
type VLAN struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	ColorHex    string `json:"colorHex"`
	Description string `json:"description"`
}

// CommentAnchor locates a discussion without coupling comments to rendering details.
type CommentAnchor struct {
	Kind     CommentAnchorKind `json:"kind"`
	TargetID string            `json:"targetId,omitempty"`
	X        float64           `json:"x,omitempty"`
	Y        float64           `json:"y,omitempty"`
}

// CommentMessage is one entry in a topology discussion thread.
type CommentMessage struct {
	ID        string    `json:"id"`
	Author    string    `json:"author"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CommentThread groups a root comment and its ordered replies at one anchor.
type CommentThread struct {
	ID        string           `json:"id"`
	Anchor    CommentAnchor    `json:"anchor"`
	Messages  []CommentMessage `json:"messages"`
	Resolved  bool             `json:"resolved"`
	CreatedAt time.Time        `json:"createdAt"`
	UpdatedAt time.Time        `json:"updatedAt"`
}

// DocumentationLink attaches an embeddable HTTP(S) resource to a topology object.
type DocumentationLink struct {
	ID         string                  `json:"id"`
	TargetKind DocumentationTargetKind `json:"targetKind"`
	TargetID   string                  `json:"targetId"`
	Label      string                  `json:"label"`
	URL        string                  `json:"url"`
	CreatedAt  time.Time               `json:"createdAt"`
}

// ShareGrant stores only a digest of a read-only share token. The clear token is
// returned once by the creation endpoint and is never persisted.
type ShareGrant struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	TokenHash string     `json:"tokenHash"`
	CreatedAt time.Time  `json:"createdAt"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

// Topology is the persisted root aggregate.
type Topology struct {
	ID                 string              `json:"id"`
	Name               string              `json:"name"`
	Revision           uint64              `json:"revision"`
	Racks              []Rack              `json:"racks"`
	Devices            []Device            `json:"devices"`
	Links              []Link              `json:"links"`
	LinkGroups         []LinkGroup         `json:"linkGroups"`
	SwitchSystems      []SwitchSystem      `json:"switchSystems"`
	FirewallClusters   []FirewallCluster   `json:"firewallClusters"`
	VLANs              []VLAN              `json:"vlans"`
	Annotations        []Annotation        `json:"annotations"`
	CommentThreads     []CommentThread     `json:"commentThreads"`
	DocumentationLinks []DocumentationLink `json:"documentationLinks"`
	ShareGrants        []ShareGrant        `json:"shareGrants,omitempty"`
	CreatedAt          time.Time           `json:"createdAt"`
	UpdatedAt          time.Time           `json:"updatedAt"`
}

// Summary is the compact representation returned by topology listings.
type Summary struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	RackCount   int       `json:"rackCount"`
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
	if t.Revision == 0 {
		t.Revision = 1
	}
	if t.Racks == nil {
		t.Racks = []Rack{}
	}
	if t.Devices == nil {
		t.Devices = []Device{}
	}
	if t.Links == nil {
		t.Links = []Link{}
	}
	if t.LinkGroups == nil {
		t.LinkGroups = []LinkGroup{}
	}
	if t.SwitchSystems == nil {
		t.SwitchSystems = []SwitchSystem{}
	}
	if t.FirewallClusters == nil {
		t.FirewallClusters = []FirewallCluster{}
	}
	if t.VLANs == nil {
		t.VLANs = []VLAN{}
	}
	if t.Annotations == nil {
		t.Annotations = []Annotation{}
	}
	if t.CommentThreads == nil {
		t.CommentThreads = []CommentThread{}
	}
	if t.DocumentationLinks == nil {
		t.DocumentationLinks = []DocumentationLink{}
	}
	if t.ShareGrants == nil {
		t.ShareGrants = []ShareGrant{}
	}
	for threadIndex := range t.CommentThreads {
		if t.CommentThreads[threadIndex].Messages == nil {
			t.CommentThreads[threadIndex].Messages = []CommentMessage{}
		}
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
	for groupIndex := range t.LinkGroups {
		group := &t.LinkGroups[groupIndex]
		if group.LinkIDs == nil {
			group.LinkIDs = []string{}
		}
		slices.Sort(group.LinkIDs)
		group.LinkIDs = slices.Compact(group.LinkIDs)
	}
	for systemIndex := range t.SwitchSystems {
		system := &t.SwitchSystems[systemIndex]
		if system.DeviceIDs == nil {
			system.DeviceIDs = []string{}
		}
		slices.Sort(system.DeviceIDs)
		system.DeviceIDs = slices.Compact(system.DeviceIDs)
	}
	for clusterIndex := range t.FirewallClusters {
		cluster := &t.FirewallClusters[clusterIndex]
		if cluster.DeviceIDs == nil {
			cluster.DeviceIDs = []string{}
		}
		slices.Sort(cluster.DeviceIDs)
		cluster.DeviceIDs = slices.Compact(cluster.DeviceIDs)
	}
}

// LogicalDeviceCount returns the number of independently counted units. Each
// valid switch system or firewall cluster contributes one logical unit.
func (t Topology) LogicalDeviceCount() int {
	groupedDevices := make(map[string]struct{})
	logicalSystems := 0
	for _, system := range t.SwitchSystems {
		if len(system.DeviceIDs) < 2 {
			continue
		}
		logicalSystems++
		for _, deviceID := range system.DeviceIDs {
			groupedDevices[deviceID] = struct{}{}
		}
	}
	for _, cluster := range t.FirewallClusters {
		if len(cluster.DeviceIDs) < 2 {
			continue
		}
		logicalSystems++
		for _, deviceID := range cluster.DeviceIDs {
			groupedDevices[deviceID] = struct{}{}
		}
	}
	return len(t.Devices) - len(groupedDevices) + logicalSystems
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
