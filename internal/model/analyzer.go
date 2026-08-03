package model

import (
	"fmt"
	"slices"
)

// Issue describes a link-level configuration problem.
type Issue struct {
	Kind     string `json:"kind"`
	LinkID   string `json:"linkId,omitempty"`
	GroupID  string `json:"groupId,omitempty"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
}

// Loop describes a switching cycle for one VLAN.
type Loop struct {
	VLANID    int      `json:"vlanId"`
	DeviceIDs []string `json:"deviceIds"`
	LinkIDs   []string `json:"linkIds"`
}

// Analysis contains validation findings computed from a topology snapshot.
type Analysis struct {
	Issues []Issue       `json:"issues"`
	Loops  []Loop        `json:"loops"`
	STP    []STPInstance `json:"stp"`
}

// Analyze compares port VLAN configuration and detects VLAN-specific cycles.
func Analyze(topology Topology) Analysis {
	ports := make(map[string]Port)
	for _, device := range topology.Devices {
		for _, port := range device.Ports {
			ports[port.ID] = port
		}
	}
	issues := []Issue{}
	for _, link := range topology.Links {
		source := ports[link.SourcePortID]
		target := ports[link.TargetPortID]
		if source.NativeVLAN > 0 && target.NativeVLAN > 0 && source.NativeVLAN != target.NativeVLAN {
			issues = append(issues, Issue{
				Kind:     "native_vlan_mismatch",
				LinkID:   link.ID,
				Message:  fmt.Sprintf("native VLAN %d meets VLAN %d", source.NativeVLAN, target.NativeVLAN),
				Severity: "warning",
			})
		}
		for _, vlanID := range missingVLANs(source.AllowedVLANs, target) {
			issues = append(issues, Issue{
				Kind:     "tagged_vlan_drop",
				LinkID:   link.ID,
				Message:  fmt.Sprintf("target drops tagged VLAN %d", vlanID),
				Severity: "warning",
			})
		}
		for _, vlanID := range missingVLANs(target.AllowedVLANs, source) {
			issues = append(issues, Issue{
				Kind:     "tagged_vlan_drop",
				LinkID:   link.ID,
				Message:  fmt.Sprintf("source drops tagged VLAN %d", vlanID),
				Severity: "warning",
			})
		}
	}
	issues = append(issues, analyzeLinkGroups(topology, ports)...)
	stp := SimulateSTP(topology, ports)
	return Analysis{Issues: issues, Loops: loopsFromSTP(stp), STP: stp}
}

func loopsFromSTP(instances []STPInstance) []Loop {
	loops := []Loop{}
	for _, instance := range instances {
		linkIDs := []string{}
		deviceIDs := []string{}
		for _, port := range instance.Ports {
			if port.Role == STPRoleBlocked {
				linkIDs = append(linkIDs, port.LinkID)
			}
		}
		if len(linkIDs) == 0 {
			continue
		}
		for _, bridge := range instance.Bridges {
			deviceIDs = append(deviceIDs, bridge.DeviceIDs...)
		}
		slices.Sort(linkIDs)
		linkIDs = slices.Compact(linkIDs)
		slices.Sort(deviceIDs)
		deviceIDs = slices.Compact(deviceIDs)
		loops = append(loops, Loop{VLANID: instance.VLANID, DeviceIDs: deviceIDs, LinkIDs: linkIDs})
	}
	return loops
}

func analyzeLinkGroups(topology Topology, ports map[string]Port) []Issue {
	links := make(map[string]Link, len(topology.Links))
	for _, link := range topology.Links {
		links[link.ID] = link
	}
	issues := []Issue{}
	logicalDevices := logicalDeviceIDs(topology)
	for _, group := range topology.LinkGroups {
		members := make([]Link, 0, len(group.LinkIDs))
		for _, linkID := range group.LinkIDs {
			members = append(members, links[linkID])
		}
		firstLinkID := group.LinkIDs[0]
		switch group.Mode {
		case LinkGroupModeTrunk:
			baseline := members[0].VLANIDs
			for _, link := range members[1:] {
				if !slices.Equal(baseline, link.VLANIDs) {
					issues = append(issues, linkGroupIssue(
						group,
						firstLinkID,
						"trunk_vlan_mismatch",
						"trunk members carry different VLAN sets",
					))
					break
				}
			}
		case LinkGroupModeLACP:
			if !sameLogicalDevicePair(members, logicalDevices) {
				issues = append(issues, linkGroupIssue(
					group,
					firstLinkID,
					"lacp_device_pair_mismatch",
					"LACP members do not connect the same device pair",
				))
			}
			issues = append(issues, aggregationMediaIssues(group, firstLinkID, members, ports)...)
		case LinkGroupModeMCLAG:
			if !hasMCLAGShape(members, logicalDevices) {
				issues = append(issues, linkGroupIssue(
					group,
					firstLinkID,
					"mclag_topology_mismatch",
					"MC-LAG members must share one device while the peer side spans multiple devices",
				))
			}
			issues = append(issues, aggregationMediaIssues(group, firstLinkID, members, ports)...)
		case LinkGroupModeFailover:
			baseline := members[0].VLANIDs
			for _, link := range members[1:] {
				if !slices.Equal(baseline, link.VLANIDs) {
					issues = append(issues, linkGroupIssue(
						group,
						firstLinkID,
						"failover_vlan_mismatch",
						"failover primary and backup links carry different VLAN sets",
					))
					break
				}
			}
		}
	}
	return issues
}

func logicalDeviceIDs(topology Topology) map[string]string {
	logical := make(map[string]string, len(topology.Devices))
	for _, device := range topology.Devices {
		logical[device.ID] = device.ID
	}
	for _, system := range topology.SwitchSystems {
		for _, deviceID := range system.DeviceIDs {
			logical[deviceID] = system.ID
		}
	}
	return logical
}

func sameLogicalDevicePair(links []Link, logicalDevices map[string]string) bool {
	left, right := orderedLogicalDevicePair(links[0], logicalDevices)
	for _, link := range links[1:] {
		currentLeft, currentRight := orderedLogicalDevicePair(link, logicalDevices)
		if currentLeft != left || currentRight != right {
			return false
		}
	}
	return true
}

func orderedLogicalDevicePair(link Link, logicalDevices map[string]string) (string, string) {
	left := logicalDevices[link.SourceDeviceID]
	right := logicalDevices[link.TargetDeviceID]
	if left < right {
		return left, right
	}
	return right, left
}

func hasMCLAGShape(links []Link, logicalDevices map[string]string) bool {
	if sameLogicalDevicePair(links, logicalDevices) && spansPhysicalPeer(links, logicalDevices) {
		return true
	}
	first := links[0]
	candidates := []string{first.SourceDeviceID, first.TargetDeviceID}
	for _, commonDeviceID := range candidates {
		peers := make(map[string]struct{}, len(links))
		valid := true
		for _, link := range links {
			switch commonDeviceID {
			case link.SourceDeviceID:
				peers[link.TargetDeviceID] = struct{}{}
			case link.TargetDeviceID:
				peers[link.SourceDeviceID] = struct{}{}
			default:
				valid = false
			}
		}
		if valid && len(peers) >= 2 {
			return true
		}
	}
	return false
}

func spansPhysicalPeer(links []Link, logicalDevices map[string]string) bool {
	physicalByLogical := make(map[string]map[string]struct{})
	for _, link := range links {
		for _, deviceID := range []string{link.SourceDeviceID, link.TargetDeviceID} {
			logicalID := logicalDevices[deviceID]
			if physicalByLogical[logicalID] == nil {
				physicalByLogical[logicalID] = make(map[string]struct{})
			}
			physicalByLogical[logicalID][deviceID] = struct{}{}
		}
	}
	for _, physicalIDs := range physicalByLogical {
		if len(physicalIDs) > 1 {
			return true
		}
	}
	return false
}

func aggregationMediaIssues(group LinkGroup, linkID string, links []Link, ports map[string]Port) []Issue {
	issues := []Issue{}
	baselineCable := links[0].CableType
	baselineSpeed := linkSpeed(links[0], ports)
	for _, link := range links[1:] {
		if link.CableType != baselineCable {
			issues = append(issues, linkGroupIssue(
				group,
				linkID,
				"aggregation_media_mismatch",
				fmt.Sprintf("%s members use different cable media", group.Mode),
			))
			break
		}
	}
	for _, link := range links[1:] {
		if linkSpeed(link, ports) != baselineSpeed {
			issues = append(issues, linkGroupIssue(
				group,
				linkID,
				"aggregation_speed_mismatch",
				fmt.Sprintf("%s members have different port speeds", group.Mode),
			))
			break
		}
	}
	return issues
}

func linkSpeed(link Link, ports map[string]Port) int {
	return min(ports[link.SourcePortID].SpeedMbps, ports[link.TargetPortID].SpeedMbps)
}

func linkGroupIssue(group LinkGroup, linkID, kind, message string) Issue {
	return Issue{
		Kind:     kind,
		LinkID:   linkID,
		GroupID:  group.ID,
		Message:  message,
		Severity: "warning",
	}
}

// TracePath returns link IDs in the shortest VLAN-valid path between two ports.
func TracePath(topology Topology, sourcePortID, targetPortID string, vlanID int) ([]string, error) {
	ports := make(map[string]Port)
	categories := make(map[string]DeviceCategory)
	for _, device := range topology.Devices {
		categories[device.ID] = device.Category
		for _, port := range device.Ports {
			ports[port.ID] = port
		}
	}
	source, exists := ports[sourcePortID]
	if !exists {
		return nil, fmt.Errorf("source port does not exist")
	}
	target, exists := ports[targetPortID]
	if !exists {
		return nil, fmt.Errorf("target port does not exist")
	}
	if !portCarriesVLAN(source, vlanID) || !portCarriesVLAN(target, vlanID) {
		return nil, fmt.Errorf("endpoint does not carry vlan %d", vlanID)
	}
	sourceIsServer := categories[source.DeviceID] == DeviceCategoryServer
	targetIsServer := categories[target.DeviceID] == DeviceCategoryServer
	if source.DeviceID == target.DeviceID {
		if sourceIsServer && sourcePortID != targetPortID {
			return nil, fmt.Errorf("server ports do not forward vlan %d", vlanID)
		}
		return []string{}, nil
	}

	type edge struct {
		deviceID   string
		linkID     string
		fromPortID string
		toPortID   string
	}
	adjacency := make(map[string][]edge)
	for _, link := range topology.Links {
		left := ports[link.SourcePortID]
		right := ports[link.TargetPortID]
		if !portCarriesVLAN(left, vlanID) || !portCarriesVLAN(right, vlanID) {
			continue
		}
		adjacency[left.DeviceID] = append(adjacency[left.DeviceID], edge{
			deviceID: right.DeviceID, linkID: link.ID, fromPortID: left.ID, toPortID: right.ID,
		})
		adjacency[right.DeviceID] = append(adjacency[right.DeviceID], edge{
			deviceID: left.DeviceID, linkID: link.ID, fromPortID: right.ID, toPortID: left.ID,
		})
	}
	type visit struct {
		deviceID string
		path     []string
	}
	queue := []visit{{deviceID: source.DeviceID, path: []string{}}}
	seen := map[string]struct{}{source.DeviceID: {}}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if current.deviceID != source.DeviceID && categories[current.deviceID] == DeviceCategoryServer {
			continue
		}
		for _, next := range adjacency[current.deviceID] {
			leavesSourceServer := current.deviceID == source.DeviceID && sourceIsServer
			if leavesSourceServer && next.fromPortID != sourcePortID {
				continue
			}
			entersTargetServer := next.deviceID == target.DeviceID && targetIsServer
			if entersTargetServer && next.toPortID != targetPortID {
				continue
			}
			if _, visited := seen[next.deviceID]; visited {
				continue
			}
			path := append(slices.Clone(current.path), next.linkID)
			if next.deviceID == target.DeviceID {
				return path, nil
			}
			seen[next.deviceID] = struct{}{}
			queue = append(queue, visit{deviceID: next.deviceID, path: path})
		}
	}
	return nil, fmt.Errorf("no path carries vlan %d", vlanID)
}

func missingVLANs(tagged []int, peer Port) []int {
	missing := []int{}
	for _, vlanID := range tagged {
		if !portCarriesVLAN(peer, vlanID) {
			missing = append(missing, vlanID)
		}
	}
	return missing
}

func portCarriesVLAN(port Port, vlanID int) bool {
	if port.Mode == PortModeUnconfigured {
		return false
	}
	return port.NativeVLAN == vlanID || slices.Contains(port.AllowedVLANs, vlanID)
}

func detectLoops(topology Topology, ports map[string]Port) []Loop {
	categories := make(map[string]DeviceCategory, len(topology.Devices))
	for _, device := range topology.Devices {
		categories[device.ID] = device.Category
	}
	loops := []Loop{}
	for _, vlan := range topology.VLANs {
		type edge struct {
			to     string
			linkID string
		}
		adjacency := make(map[string][]edge)
		for _, link := range topology.Links {
			left := ports[link.SourcePortID]
			right := ports[link.TargetPortID]
			if categories[left.DeviceID] == DeviceCategoryServer || categories[right.DeviceID] == DeviceCategoryServer {
				continue
			}
			if !portCarriesVLAN(left, vlan.ID) || !portCarriesVLAN(right, vlan.ID) {
				continue
			}
			adjacency[left.DeviceID] = append(adjacency[left.DeviceID], edge{to: right.DeviceID, linkID: link.ID})
			adjacency[right.DeviceID] = append(adjacency[right.DeviceID], edge{to: left.DeviceID, linkID: link.ID})
		}
		visited := make(map[string]bool)
		var walk func(string, string, []string, []string) *Loop
		walk = func(deviceID, parent string, devices, links []string) *Loop {
			visited[deviceID] = true
			devices = append(devices, deviceID)
			for _, next := range adjacency[deviceID] {
				if next.to == parent {
					continue
				}
				if visited[next.to] {
					return &Loop{VLANID: vlan.ID, DeviceIDs: devices, LinkIDs: append(links, next.linkID)}
				}
				if found := walk(next.to, deviceID, devices, append(links, next.linkID)); found != nil {
					return found
				}
			}
			return nil
		}
		for deviceID := range adjacency {
			if visited[deviceID] {
				continue
			}
			if found := walk(deviceID, "", []string{}, []string{}); found != nil {
				loops = append(loops, *found)
				break
			}
		}
	}
	return loops
}
