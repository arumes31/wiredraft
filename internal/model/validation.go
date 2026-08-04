package model

import (
	"errors"
	"fmt"
	"math"
	"net/netip"
	"net/url"
	"regexp"
	"slices"
	"strings"
)

var (
	colorPattern         = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	idPattern            = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	digestPattern        = regexp.MustCompile(`^[0-9a-f]{64}$`)
	hostnameLabelPattern = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$`)
)

// Validate checks the complete topology aggregate and all cross-references.
func (t Topology) Validate() error {
	if !idPattern.MatchString(t.ID) {
		return errors.New("topology id must be a version 4 uuid")
	}
	if strings.TrimSpace(t.Name) == "" || len(t.Name) > 120 {
		return errors.New("topology name must contain 1 to 120 characters")
	}
	organization := strings.TrimSpace(t.Organization)
	location := strings.TrimSpace(t.Location)
	if len(organization) > 120 {
		return errors.New("topology organization must not exceed 120 characters")
	}
	if len(location) > 120 {
		return errors.New("topology location must not exceed 120 characters")
	}
	if (organization == "") != (location == "") {
		return errors.New("topology organization and location must be assigned together")
	}
	if t.CreatedAt.IsZero() || t.UpdatedAt.IsZero() {
		return errors.New("topology timestamps must be set")
	}
	if t.Revision == 0 {
		return errors.New("topology revision must be positive")
	}

	rackByID := make(map[string]Rack, len(t.Racks))
	for _, rack := range t.Racks {
		if err := rack.Validate(); err != nil {
			return fmt.Errorf("validating rack %q: %w", rack.Name, err)
		}
		if _, exists := rackByID[rack.ID]; exists {
			return fmt.Errorf("duplicate rack id %q", rack.ID)
		}
		rackByID[rack.ID] = rack
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
	deviceCategories := make(map[string]DeviceCategory, len(t.Devices))
	ports := make(map[string]Port)
	type placement struct {
		deviceName string
		firstUnit  int
		lastUnit   int
	}
	placements := make(map[string][]placement, len(t.Racks))
	for _, device := range t.Devices {
		if err := device.Validate(vlanIDs); err != nil {
			return fmt.Errorf("validating device %q: %w", device.Name, err)
		}
		if _, exists := deviceIDs[device.ID]; exists {
			return fmt.Errorf("duplicate device id %q", device.ID)
		}
		if device.RackID == "" {
			if device.RackUnit != 0 {
				return fmt.Errorf("device %q has a rack unit without a rack", device.Name)
			}
		} else {
			rack, exists := rackByID[device.RackID]
			if !exists {
				return fmt.Errorf("device %q references unknown rack %q", device.Name, device.RackID)
			}
			firstUnit := device.RackUnit
			lastUnit := firstUnit + device.Faceplate.UnitsU - 1
			if firstUnit < 1 || lastUnit > rack.HeightU {
				return fmt.Errorf("device %q does not fit in rack %q", device.Name, rack.Name)
			}
			for _, current := range placements[rack.ID] {
				overlaps := firstUnit <= current.lastUnit && lastUnit >= current.firstUnit
				if overlaps {
					return fmt.Errorf("devices %q and %q overlap in rack %q", current.deviceName, device.Name, rack.Name)
				}
			}
			placements[rack.ID] = append(placements[rack.ID], placement{
				deviceName: device.Name,
				firstUnit:  firstUnit,
				lastUnit:   lastUnit,
			})
		}
		deviceIDs[device.ID] = struct{}{}
		deviceCategories[device.ID] = device.Category
		for _, port := range device.Ports {
			if _, exists := ports[port.ID]; exists {
				return fmt.Errorf("duplicate port id %q", port.ID)
			}
			ports[port.ID] = port
		}
	}

	systemIDs := make(map[string]struct{}, len(t.SwitchSystems))
	groupedDevices := make(map[string]string, len(t.Devices))
	for _, system := range t.SwitchSystems {
		if err := system.Validate(deviceIDs, t.Devices); err != nil {
			return fmt.Errorf("validating switch system %q: %w", system.Name, err)
		}
		if _, exists := systemIDs[system.ID]; exists {
			return fmt.Errorf("duplicate switch system id %q", system.ID)
		}
		systemIDs[system.ID] = struct{}{}
		for _, deviceID := range system.DeviceIDs {
			if existing, exists := groupedDevices[deviceID]; exists {
				return fmt.Errorf("device %q belongs to switch systems %q and %q", deviceID, existing, system.ID)
			}
			groupedDevices[deviceID] = system.ID
		}
	}
	clusterIDs := make(map[string]struct{}, len(t.FirewallClusters))
	clusteredDevices := make(map[string]string, len(t.Devices))
	for _, cluster := range t.FirewallClusters {
		if err := cluster.Validate(deviceIDs, t.Devices); err != nil {
			return fmt.Errorf("validating firewall cluster %q: %w", cluster.Name, err)
		}
		if _, exists := clusterIDs[cluster.ID]; exists {
			return fmt.Errorf("duplicate firewall cluster id %q", cluster.ID)
		}
		clusterIDs[cluster.ID] = struct{}{}
		for _, deviceID := range cluster.DeviceIDs {
			if existing, exists := clusteredDevices[deviceID]; exists {
				return fmt.Errorf("device %q belongs to firewall clusters %q and %q", deviceID, existing, cluster.ID)
			}
			clusteredDevices[deviceID] = cluster.ID
		}
	}

	linkIDs := make(map[string]struct{}, len(t.Links))
	occupiedTerminations := make(map[string]string, len(t.Links)*2)
	for _, link := range t.Links {
		if err := link.Validate(deviceIDs, ports, vlanIDs); err != nil {
			return fmt.Errorf("validating link %q: %w", link.ID, err)
		}
		if link.EffectiveSourceSide() == LinkEndpointSideRear && deviceCategories[link.SourceDeviceID] != DeviceCategoryPatchPanel {
			return fmt.Errorf("validating link %q: source rear termination requires a patch panel", link.ID)
		}
		if link.EffectiveTargetSide() == LinkEndpointSideRear && deviceCategories[link.TargetDeviceID] != DeviceCategoryPatchPanel {
			return fmt.Errorf("validating link %q: target rear termination requires a patch panel", link.ID)
		}
		if _, exists := linkIDs[link.ID]; exists {
			return fmt.Errorf("duplicate link id %q", link.ID)
		}
		linkIDs[link.ID] = struct{}{}
		terminations := []struct {
			portID string
			side   LinkEndpointSide
		}{
			{portID: link.SourcePortID, side: link.EffectiveSourceSide()},
			{portID: link.TargetPortID, side: link.EffectiveTargetSide()},
		}
		for _, termination := range terminations {
			key := termination.portID + "\x00" + string(termination.side)
			if existing, exists := occupiedTerminations[key]; exists {
				return fmt.Errorf("port %q %s side is occupied by links %q and %q", termination.portID, termination.side, existing, link.ID)
			}
			occupiedTerminations[key] = link.ID
		}
	}
	groupIDs := make(map[string]struct{}, len(t.LinkGroups))
	groupedLinks := make(map[string]string, len(t.Links))
	for _, group := range t.LinkGroups {
		if err := group.Validate(linkIDs); err != nil {
			return fmt.Errorf("validating link group %q: %w", group.Name, err)
		}
		if _, exists := groupIDs[group.ID]; exists {
			return fmt.Errorf("duplicate link group id %q", group.ID)
		}
		groupIDs[group.ID] = struct{}{}
		for _, linkID := range group.LinkIDs {
			if existing, exists := groupedLinks[linkID]; exists {
				return fmt.Errorf("link %q belongs to groups %q and %q", linkID, existing, group.ID)
			}
			groupedLinks[linkID] = group.ID
		}
	}
	if len(t.Annotations) > 1000 {
		return errors.New("topology may contain at most 1000 annotations")
	}
	annotationIDs := make(map[string]struct{}, len(t.Annotations))
	for _, annotation := range t.Annotations {
		if err := annotation.Validate(); err != nil {
			return fmt.Errorf("validating annotation %q: %w", annotation.ID, err)
		}
		if _, exists := annotationIDs[annotation.ID]; exists {
			return fmt.Errorf("duplicate annotation id %q", annotation.ID)
		}
		annotationIDs[annotation.ID] = struct{}{}
	}
	if len(t.CommentThreads) > 500 {
		return errors.New("topology may contain at most 500 comment threads")
	}
	threadIDs := make(map[string]struct{}, len(t.CommentThreads))
	for _, thread := range t.CommentThreads {
		if err := thread.Validate(deviceIDs, ports, linkIDs); err != nil {
			return fmt.Errorf("validating comment thread %q: %w", thread.ID, err)
		}
		if _, exists := threadIDs[thread.ID]; exists {
			return fmt.Errorf("duplicate comment thread id %q", thread.ID)
		}
		threadIDs[thread.ID] = struct{}{}
	}
	if len(t.DocumentationLinks) > 1000 {
		return errors.New("topology may contain at most 1000 documentation links")
	}
	documentationLinkIDs := make(map[string]struct{}, len(t.DocumentationLinks))
	for _, documentationLink := range t.DocumentationLinks {
		if err := documentationLink.Validate(t.ID, rackByID, deviceIDs, ports, linkIDs); err != nil {
			return fmt.Errorf("validating documentation link %q: %w", documentationLink.ID, err)
		}
		if _, exists := documentationLinkIDs[documentationLink.ID]; exists {
			return fmt.Errorf("duplicate documentation link id %q", documentationLink.ID)
		}
		documentationLinkIDs[documentationLink.ID] = struct{}{}
	}
	if len(t.ShareGrants) > 64 {
		return errors.New("topology may contain at most 64 share grants")
	}
	shareIDs := make(map[string]struct{}, len(t.ShareGrants))
	for _, share := range t.ShareGrants {
		if err := share.Validate(); err != nil {
			return fmt.Errorf("validating share grant %q: %w", share.ID, err)
		}
		if _, exists := shareIDs[share.ID]; exists {
			return fmt.Errorf("duplicate share grant id %q", share.ID)
		}
		shareIDs[share.ID] = struct{}{}
	}
	return nil
}

// Validate checks a canvas annotation's shape and bounded world coordinates.
func (annotation Annotation) Validate() error {
	if !idPattern.MatchString(annotation.ID) {
		return errors.New("annotation id must be a version 4 uuid")
	}
	if !slices.Contains([]string{"arrow", "rectangle", "text"}, annotation.Type) {
		return errors.New("annotation type must be arrow, rectangle, or text")
	}
	for _, coordinate := range []float64{annotation.X1, annotation.Y1, annotation.X2, annotation.Y2} {
		if math.IsNaN(coordinate) || math.IsInf(coordinate, 0) || math.Abs(coordinate) > 1_000_000 {
			return errors.New("annotation coordinates must be finite and inside the canvas bounds")
		}
	}
	if annotation.Type == "text" && (strings.TrimSpace(annotation.Text) == "" || len(annotation.Text) > 500) {
		return errors.New("text annotation must contain 1 to 500 characters")
	}
	if !colorPattern.MatchString(annotation.Color) {
		return errors.New("annotation color must be a six-digit hex color")
	}
	return nil
}

// Validate checks an anchored threaded discussion and all messages.
func (thread CommentThread) Validate(deviceIDs map[string]struct{}, ports map[string]Port, linkIDs map[string]struct{}) error {
	if !idPattern.MatchString(thread.ID) {
		return errors.New("thread id must be a version 4 uuid")
	}
	if thread.CreatedAt.IsZero() || thread.UpdatedAt.IsZero() || thread.UpdatedAt.Before(thread.CreatedAt) {
		return errors.New("thread timestamps are invalid")
	}
	switch thread.Anchor.Kind {
	case CommentAnchorCanvas:
		if thread.Anchor.TargetID != "" || math.IsNaN(thread.Anchor.X) || math.IsNaN(thread.Anchor.Y) || math.IsInf(thread.Anchor.X, 0) || math.IsInf(thread.Anchor.Y, 0) || math.Abs(thread.Anchor.X) > 1_000_000 || math.Abs(thread.Anchor.Y) > 1_000_000 {
			return errors.New("canvas anchor must have finite coordinates and no target")
		}
	case CommentAnchorDevice:
		if _, exists := deviceIDs[thread.Anchor.TargetID]; !exists {
			return errors.New("device anchor references an unknown device")
		}
	case CommentAnchorPort:
		if _, exists := ports[thread.Anchor.TargetID]; !exists {
			return errors.New("port anchor references an unknown port")
		}
	case CommentAnchorLink:
		if _, exists := linkIDs[thread.Anchor.TargetID]; !exists {
			return errors.New("link anchor references an unknown link")
		}
	default:
		return errors.New("comment anchor kind is invalid")
	}
	if len(thread.Messages) == 0 || len(thread.Messages) > 200 {
		return errors.New("thread must contain 1 to 200 messages")
	}
	messageIDs := make(map[string]struct{}, len(thread.Messages))
	for _, message := range thread.Messages {
		if err := message.Validate(); err != nil {
			return err
		}
		if _, exists := messageIDs[message.ID]; exists {
			return fmt.Errorf("duplicate message id %q", message.ID)
		}
		messageIDs[message.ID] = struct{}{}
	}
	return nil
}

// Validate checks a comment message's identity, attribution, body, and timestamps.
func (message CommentMessage) Validate() error {
	if !idPattern.MatchString(message.ID) {
		return errors.New("message id must be a version 4 uuid")
	}
	if author := strings.TrimSpace(message.Author); author == "" || len(author) > 80 {
		return errors.New("message author must contain 1 to 80 characters")
	}
	if body := strings.TrimSpace(message.Body); body == "" || len(body) > 4000 {
		return errors.New("message body must contain 1 to 4000 characters")
	}
	if message.CreatedAt.IsZero() || message.UpdatedAt.IsZero() || message.UpdatedAt.Before(message.CreatedAt) {
		return errors.New("message timestamps are invalid")
	}
	return nil
}

// Validate checks an external documentation URL and its target reference.
func (documentationLink DocumentationLink) Validate(topologyID string, racks map[string]Rack, devices map[string]struct{}, ports map[string]Port, links map[string]struct{}) error {
	if !idPattern.MatchString(documentationLink.ID) {
		return errors.New("documentation link id must be a version 4 uuid")
	}
	if label := strings.TrimSpace(documentationLink.Label); label == "" || len(label) > 120 {
		return errors.New("documentation link label must contain 1 to 120 characters")
	}
	if len(documentationLink.URL) > 2048 {
		return errors.New("documentation link URL is too long")
	}
	parsed, err := url.ParseRequestURI(documentationLink.URL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil {
		return errors.New("documentation link must be an HTTP(S) URL without credentials")
	}
	switch documentationLink.TargetKind {
	case DocumentationTargetTopology:
		if documentationLink.TargetID != topologyID {
			return errors.New("documentation link references an unknown topology")
		}
	case DocumentationTargetRack:
		if _, exists := racks[documentationLink.TargetID]; !exists {
			return errors.New("documentation link references an unknown rack")
		}
	case DocumentationTargetDevice:
		if _, exists := devices[documentationLink.TargetID]; !exists {
			return errors.New("documentation link references an unknown device")
		}
	case DocumentationTargetPort:
		if _, exists := ports[documentationLink.TargetID]; !exists {
			return errors.New("documentation link references an unknown port")
		}
	case DocumentationTargetLink:
		if _, exists := links[documentationLink.TargetID]; !exists {
			return errors.New("documentation link references an unknown link")
		}
	default:
		return errors.New("documentation link target kind is invalid")
	}
	if documentationLink.CreatedAt.IsZero() {
		return errors.New("documentation link creation time is required")
	}
	return nil
}

// Validate checks persisted read-only share metadata without exposing its token.
func (share ShareGrant) Validate() error {
	if !idPattern.MatchString(share.ID) {
		return errors.New("share grant id must be a version 4 uuid")
	}
	if len(strings.TrimSpace(share.Name)) > 80 {
		return errors.New("share grant name may contain at most 80 characters")
	}
	if !digestPattern.MatchString(share.TokenHash) {
		return errors.New("share token hash must be a SHA-256 hex digest")
	}
	if share.CreatedAt.IsZero() {
		return errors.New("share grant creation time is required")
	}
	if share.ExpiresAt != nil && !share.ExpiresAt.After(share.CreatedAt) {
		return errors.New("share grant expiration must be after creation")
	}
	return nil
}

// Validate checks rack identity, whole-unit capacity, and display properties.
func (r Rack) Validate() error {
	if !idPattern.MatchString(r.ID) {
		return errors.New("rack id must be a version 4 uuid")
	}
	if strings.TrimSpace(r.Name) == "" || len(r.Name) > 120 {
		return errors.New("rack name must contain 1 to 120 characters")
	}
	if r.HeightU < 6 || r.HeightU > 48 {
		return errors.New("rack height must be between 6 and 48 units")
	}
	if !colorPattern.MatchString(r.Color) {
		return errors.New("rack color must be a six-digit hex color")
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
	for label, value := range map[string]string{
		"device serial number": d.SerialNumber,
		"device asset tag":     d.AssetTag,
		"device owner":         d.Owner,
	} {
		if len(strings.TrimSpace(value)) > 120 {
			return fmt.Errorf("%s must not exceed 120 characters", label)
		}
	}
	if d.Hostname != "" && !validHostname(strings.TrimSpace(d.Hostname)) {
		return errors.New("device hostname must be a valid DNS hostname")
	}
	if d.ManagementIP != "" {
		if _, err := netip.ParseAddr(strings.TrimSpace(d.ManagementIP)); err != nil {
			return errors.New("device management ip must be a literal IPv4 or IPv6 address")
		}
	}
	if err := d.Location.Validate(); err != nil {
		return fmt.Errorf("validating device location: %w", err)
	}
	if d.STPPriority != 0 && (d.STPPriority < 4096 || d.STPPriority > 61440 || d.STPPriority%4096 != 0) {
		return errors.New("stp priority must be zero/default or a 4096 increment from 4096 to 61440")
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

// Validate checks structured organizational location metadata.
func (location DeviceLocation) Validate() error {
	for label, value := range map[string]string{
		"site": location.Site, "building": location.Building, "floor": location.Floor,
		"room": location.Room, "rack": location.Rack,
	} {
		if len(strings.TrimSpace(value)) > 120 {
			return fmt.Errorf("location %s must not exceed 120 characters", label)
		}
	}
	if location.RackUnit < 0 || location.RackUnit > 48 {
		return errors.New("location rack unit must be between 0 and 48")
	}
	return nil
}

func validHostname(hostname string) bool {
	hostname = strings.TrimSuffix(hostname, ".")
	if hostname == "" || len(hostname) > 253 {
		return false
	}
	for _, label := range strings.Split(hostname, ".") {
		if !hostnameLabelPattern.MatchString(label) {
			return false
		}
	}
	return true
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
	if p.SpeedMbps < 0 || p.SpeedMbps > 800000 {
		return errors.New("port speed must be between 0 and 800000 mbps")
	}
	if len(p.Group) > 40 {
		return errors.New("port group must not exceed 40 characters")
	}
	if len(strings.TrimSpace(p.MediaType)) > 80 {
		return errors.New("port media type must not exceed 80 characters")
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
	if !slices.Contains([]LinkEndpointSide{"", LinkEndpointSideFront, LinkEndpointSideRear}, l.SourceSide) {
		return fmt.Errorf("unknown source endpoint side %q", l.SourceSide)
	}
	if !slices.Contains([]LinkEndpointSide{"", LinkEndpointSideFront, LinkEndpointSideRear}, l.TargetSide) {
		return fmt.Errorf("unknown target endpoint side %q", l.TargetSide)
	}
	if (l.EffectiveSourceSide() == LinkEndpointSideRear) != (l.EffectiveTargetSide() == LinkEndpointSideRear) {
		return errors.New("rear panel mappings must terminate rear-to-rear")
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

// Validate checks a link group's structural invariants. Protocol-shape
// mismatches are advisory findings produced by Analyze.
func (g LinkGroup) Validate(linkIDs map[string]struct{}) error {
	if !idPattern.MatchString(g.ID) {
		return errors.New("link group id must be a version 4 uuid")
	}
	if strings.TrimSpace(g.Name) == "" || len(g.Name) > 120 {
		return errors.New("link group name must contain 1 to 120 characters")
	}
	if !slices.Contains(validLinkGroupModes, g.Mode) {
		return fmt.Errorf("unknown link group mode %q", g.Mode)
	}
	if len(g.LinkIDs) < 2 {
		return errors.New("link group must contain at least two links")
	}
	seen := make(map[string]struct{}, len(g.LinkIDs))
	for _, linkID := range g.LinkIDs {
		if _, exists := linkIDs[linkID]; !exists {
			return fmt.Errorf("link %q does not exist", linkID)
		}
		if _, exists := seen[linkID]; exists {
			return fmt.Errorf("duplicate member link %q", linkID)
		}
		seen[linkID] = struct{}{}
	}
	if g.Mode == LinkGroupModeFailover {
		if g.PrimaryLinkID == "" {
			return errors.New("failover group must identify its primary link")
		}
		if _, exists := seen[g.PrimaryLinkID]; !exists {
			return errors.New("failover primary link must be a group member")
		}
	} else if g.PrimaryLinkID != "" {
		return errors.New("only failover groups may identify a primary link")
	}
	if len(g.Notes) > 1000 {
		return errors.New("link group notes must not exceed 1000 characters")
	}
	return nil
}

// Validate checks a logical switch system's structural invariants. Technology
// and model compatibility remain advisory so unusual real-world designs can be
// recorded without weakening identity and membership integrity.
func (s SwitchSystem) Validate(deviceIDs map[string]struct{}, devices []Device) error {
	if !idPattern.MatchString(s.ID) {
		return errors.New("switch system id must be a version 4 uuid")
	}
	if strings.TrimSpace(s.Name) == "" || len(s.Name) > 120 {
		return errors.New("switch system name must contain 1 to 120 characters")
	}
	if !slices.Contains(validSwitchSystemModes, s.Mode) {
		return fmt.Errorf("unknown switch system mode %q", s.Mode)
	}
	if len(s.DeviceIDs) < 2 {
		return errors.New("switch system must contain at least two devices")
	}
	deviceCategories := make(map[string]DeviceCategory, len(devices))
	for _, device := range devices {
		deviceCategories[device.ID] = device.Category
	}
	seen := make(map[string]struct{}, len(s.DeviceIDs))
	for _, deviceID := range s.DeviceIDs {
		if _, exists := deviceIDs[deviceID]; !exists {
			return fmt.Errorf("device %q does not exist", deviceID)
		}
		if deviceCategories[deviceID] != DeviceCategorySwitch {
			return fmt.Errorf("device %q is not a switch", deviceID)
		}
		if _, exists := seen[deviceID]; exists {
			return fmt.Errorf("duplicate member device %q", deviceID)
		}
		seen[deviceID] = struct{}{}
	}
	if len(s.Notes) > 1000 {
		return errors.New("switch system notes must not exceed 1000 characters")
	}
	return nil
}

// Validate checks a firewall cluster's identity, membership, and forwarding
// role invariants. Vendor and model compatibility remain advisory.
func (c FirewallCluster) Validate(deviceIDs map[string]struct{}, devices []Device) error {
	if !idPattern.MatchString(c.ID) {
		return errors.New("firewall cluster id must be a version 4 uuid")
	}
	if strings.TrimSpace(c.Name) == "" || len(c.Name) > 120 {
		return errors.New("firewall cluster name must contain 1 to 120 characters")
	}
	if !slices.Contains(validFirewallClusterModes, c.Mode) {
		return fmt.Errorf("unknown firewall cluster mode %q", c.Mode)
	}
	if len(c.DeviceIDs) < 2 {
		return errors.New("firewall cluster must contain at least two devices")
	}
	deviceCategories := make(map[string]DeviceCategory, len(devices))
	for _, device := range devices {
		deviceCategories[device.ID] = device.Category
	}
	seen := make(map[string]struct{}, len(c.DeviceIDs))
	for _, deviceID := range c.DeviceIDs {
		if _, exists := deviceIDs[deviceID]; !exists {
			return fmt.Errorf("device %q does not exist", deviceID)
		}
		if deviceCategories[deviceID] != DeviceCategoryFirewall {
			return fmt.Errorf("device %q is not a firewall", deviceID)
		}
		if _, exists := seen[deviceID]; exists {
			return fmt.Errorf("duplicate member device %q", deviceID)
		}
		seen[deviceID] = struct{}{}
	}
	if c.Mode == FirewallClusterModeActivePassive {
		if c.ActiveDeviceID == "" {
			return errors.New("active-passive cluster must identify its active device")
		}
		if _, exists := seen[c.ActiveDeviceID]; !exists {
			return errors.New("active device must be a cluster member")
		}
	} else if c.ActiveDeviceID != "" {
		return errors.New("active-active cluster must not identify one active device")
	}
	if len(c.Notes) > 1000 {
		return errors.New("firewall cluster notes must not exceed 1000 characters")
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
	PortTypeRJ45MGIG,
	PortTypeRJ4510G,
	PortTypeDSLRJ11,
	PortTypeCoaxF,
	PortTypeSFP1G,
	PortTypeSFPPlus10G,
	PortTypeSFP2825G,
	PortTypeSFP5650G,
	PortTypeQSFPPlus40G,
	PortTypeQSFP28100G,
	PortTypeQSFP56200G,
	PortTypeQSFPDD400G,
	PortTypeCFP100G,
	PortTypeCFP2100G,
	PortTypeCFP4100G,
	PortTypeOSFP800G,
	PortTypeFiberLC,
	PortTypeFiberSC,
	PortTypeFiberMPO,
	PortTypeUSBMicro,
	PortTypeUSBC,
	PortTypeStack,
	PortTypeConsole,
	PortTypePower,
}

var validPortModes = []PortMode{
	PortModeAccess,
	PortModeTrunk,
	PortModeHybrid,
	PortModeUnconfigured,
}

var validLinkGroupModes = []LinkGroupMode{
	LinkGroupModeTrunk,
	LinkGroupModeLACP,
	LinkGroupModeMCLAG,
	LinkGroupModeFailover,
}

var validSwitchSystemModes = []SwitchSystemMode{
	SwitchSystemModeStack,
	SwitchSystemModeVSF,
	SwitchSystemModeMCLAG,
	SwitchSystemModeStackWise,
	SwitchSystemModeVSS,
	SwitchSystemModeVirtualChassis,
	SwitchSystemModeIRF,
	SwitchSystemModeCustom,
}

var validFirewallClusterModes = []FirewallClusterMode{
	FirewallClusterModeActiveActive,
	FirewallClusterModeActivePassive,
}
