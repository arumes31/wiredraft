package model

import (
	"fmt"
	"slices"
)

// Issue describes a link-level configuration problem.
type Issue struct {
	Kind     string `json:"kind"`
	LinkID   string `json:"linkId"`
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
	Issues []Issue `json:"issues"`
	Loops  []Loop  `json:"loops"`
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
	return Analysis{Issues: issues, Loops: detectLoops(topology, ports)}
}

// TracePath returns link IDs in the shortest VLAN-valid path between two ports.
func TracePath(topology Topology, sourcePortID, targetPortID string, vlanID int) ([]string, error) {
	ports := make(map[string]Port)
	for _, device := range topology.Devices {
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
	if source.DeviceID == target.DeviceID {
		return []string{}, nil
	}

	type edge struct {
		deviceID string
		linkID   string
	}
	adjacency := make(map[string][]edge)
	for _, link := range topology.Links {
		left := ports[link.SourcePortID]
		right := ports[link.TargetPortID]
		if !portCarriesVLAN(left, vlanID) || !portCarriesVLAN(right, vlanID) {
			continue
		}
		adjacency[left.DeviceID] = append(adjacency[left.DeviceID], edge{deviceID: right.DeviceID, linkID: link.ID})
		adjacency[right.DeviceID] = append(adjacency[right.DeviceID], edge{deviceID: left.DeviceID, linkID: link.ID})
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
		for _, next := range adjacency[current.deviceID] {
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
