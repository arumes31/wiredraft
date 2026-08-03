package model

import (
	"cmp"
	"fmt"
	"slices"
)

const (
	STPRoleRoot        = "Root"
	STPRoleDesignated  = "Designated"
	STPRoleBlocked     = "Blocked"
	STPStateForwarding = "forwarding"
	STPStateBlocking   = "blocking"
	defaultSTPPriority = 32768
)

// STPInstance is one connected spanning-tree domain for a VLAN.
type STPInstance struct {
	VLANID       int              `json:"vlanId"`
	Domain       int              `json:"domain"`
	RootBridgeID string           `json:"rootBridgeId"`
	RootName     string           `json:"rootName"`
	Bridges      []STPBridgeState `json:"bridges"`
	Ports        []STPPortState   `json:"ports"`
	Paths        []STPPath        `json:"paths"`
}

// STPBridgeState describes a logical bridge after stack/peer consolidation.
type STPBridgeState struct {
	BridgeID     string   `json:"bridgeId"`
	Name         string   `json:"name"`
	DeviceIDs    []string `json:"deviceIds"`
	Priority     int      `json:"priority"`
	RootPathCost int      `json:"rootPathCost"`
	RootPortIDs  []string `json:"rootPortIds"`
}

// STPPortState maps a logical STP decision back to a physical cable endpoint.
type STPPortState struct {
	PortID          string `json:"portId"`
	DeviceID        string `json:"deviceId"`
	LinkID          string `json:"linkId"`
	GroupID         string `json:"groupId,omitempty"`
	LogicalBridgeID string `json:"logicalBridgeId"`
	PeerBridgeID    string `json:"peerBridgeId"`
	Role            string `json:"role"`
	State           string `json:"state"`
}

// STPPath is the deterministic convergence path from one bridge to the root.
type STPPath struct {
	BridgeID  string   `json:"bridgeId"`
	BridgeIDs []string `json:"bridgeIds"`
	LinkIDs   []string `json:"linkIds"`
}

type stpBridge struct {
	ID        string
	Name      string
	DeviceIDs []string
	Priority  int
}

type stpEdge struct {
	ID      string
	GroupID string
	Left    string
	Right   string
	Links   []Link
}

type stpNeighbor struct {
	BridgeID string
	Edge     stpEdge
}

// SimulateSTP computes a deterministic common spanning tree per VLAN and
// connected switching domain.
func SimulateSTP(topology Topology, ports map[string]Port) []STPInstance {
	bridgeByDevice, bridges := stpLogicalBridges(topology)
	instances := []STPInstance{}
	for _, vlan := range topology.VLANs {
		edges := stpEdges(topology, ports, bridgeByDevice, vlan.ID)
		for domain, component := range stpComponents(edges) {
			instances = append(instances, simulateSTPComponent(vlan.ID, domain+1, component, bridges, bridgeByDevice))
		}
	}
	slices.SortFunc(instances, func(left, right STPInstance) int {
		if result := cmp.Compare(left.VLANID, right.VLANID); result != 0 {
			return result
		}
		return cmp.Compare(left.Domain, right.Domain)
	})
	return instances
}

func stpLogicalBridges(topology Topology) (map[string]string, map[string]stpBridge) {
	devices := make(map[string]Device, len(topology.Devices))
	for _, device := range topology.Devices {
		devices[device.ID] = device
	}
	bridgeByDevice := make(map[string]string)
	bridges := make(map[string]stpBridge)
	for _, system := range topology.SwitchSystems {
		bridge := stpBridge{ID: system.ID, Name: system.Name, Priority: 61440}
		for _, deviceID := range system.DeviceIDs {
			device, exists := devices[deviceID]
			if !exists || device.Category != DeviceCategorySwitch {
				continue
			}
			bridge.DeviceIDs = append(bridge.DeviceIDs, deviceID)
			bridge.Priority = min(bridge.Priority, normalizedSTPPriority(device.STPPriority))
			bridgeByDevice[deviceID] = bridge.ID
		}
		if len(bridge.DeviceIDs) > 0 {
			slices.Sort(bridge.DeviceIDs)
			bridges[bridge.ID] = bridge
		}
	}
	for _, device := range topology.Devices {
		if device.Category != DeviceCategorySwitch {
			continue
		}
		if _, grouped := bridgeByDevice[device.ID]; grouped {
			continue
		}
		bridgeByDevice[device.ID] = device.ID
		name := device.Hostname
		if name == "" {
			name = device.Name
		}
		bridges[device.ID] = stpBridge{
			ID: device.ID, Name: name, DeviceIDs: []string{device.ID}, Priority: normalizedSTPPriority(device.STPPriority),
		}
	}
	return bridgeByDevice, bridges
}

func normalizedSTPPriority(priority int) int {
	if priority == 0 {
		return defaultSTPPriority
	}
	return priority
}

func stpEdges(topology Topology, ports map[string]Port, bridgeByDevice map[string]string, vlanID int) []stpEdge {
	links := make(map[string]Link, len(topology.Links))
	groupByLink := make(map[string]LinkGroup)
	for _, link := range topology.Links {
		links[link.ID] = link
	}
	for _, group := range topology.LinkGroups {
		for _, linkID := range group.LinkIDs {
			groupByLink[linkID] = group
		}
	}
	eligible := func(link Link) (string, string, bool) {
		left, leftExists := bridgeByDevice[link.SourceDeviceID]
		right, rightExists := bridgeByDevice[link.TargetDeviceID]
		if !leftExists || !rightExists || left == right || !slices.Contains(link.VLANIDs, vlanID) ||
			!portCarriesVLAN(ports[link.SourcePortID], vlanID) || !portCarriesVLAN(ports[link.TargetPortID], vlanID) {
			return "", "", false
		}
		if left > right {
			left, right = right, left
		}
		return left, right, true
	}
	edges := []stpEdge{}
	processedGroups := make(map[string]struct{})
	for _, link := range topology.Links {
		group, grouped := groupByLink[link.ID]
		if !grouped {
			left, right, ok := eligible(link)
			if ok {
				edges = append(edges, stpEdge{ID: link.ID, Left: left, Right: right, Links: []Link{link}})
			}
			continue
		}
		if _, processed := processedGroups[group.ID]; processed {
			continue
		}
		processedGroups[group.ID] = struct{}{}
		memberIDs := group.LinkIDs
		if group.Mode == LinkGroupModeFailover {
			memberIDs = []string{group.PrimaryLinkID}
		}
		byPair := make(map[string][]Link)
		for _, linkID := range memberIDs {
			member, exists := links[linkID]
			if !exists {
				continue
			}
			left, right, ok := eligible(member)
			if !ok {
				continue
			}
			key := left + "\x00" + right
			byPair[key] = append(byPair[key], member)
		}
		keys := make([]string, 0, len(byPair))
		for key := range byPair {
			keys = append(keys, key)
		}
		slices.Sort(keys)
		for pairIndex, key := range keys {
			members := byPair[key]
			left, right, _ := eligible(members[0])
			edgeID := group.ID
			if len(keys) > 1 {
				edgeID = fmt.Sprintf("%s:%d", group.ID, pairIndex+1)
			}
			edges = append(edges, stpEdge{ID: edgeID, GroupID: group.ID, Left: left, Right: right, Links: members})
		}
	}
	slices.SortFunc(edges, func(left, right stpEdge) int { return cmp.Compare(left.ID, right.ID) })
	return edges
}

func stpComponents(edges []stpEdge) [][]stpEdge {
	adjacency := make(map[string][]stpEdge)
	for _, edge := range edges {
		adjacency[edge.Left] = append(adjacency[edge.Left], edge)
		adjacency[edge.Right] = append(adjacency[edge.Right], edge)
	}
	bridgeIDs := make([]string, 0, len(adjacency))
	for bridgeID := range adjacency {
		bridgeIDs = append(bridgeIDs, bridgeID)
	}
	slices.Sort(bridgeIDs)
	visited := make(map[string]struct{})
	components := [][]stpEdge{}
	for _, start := range bridgeIDs {
		if _, exists := visited[start]; exists {
			continue
		}
		queue := []string{start}
		edgesByID := make(map[string]stpEdge)
		visited[start] = struct{}{}
		for len(queue) > 0 {
			current := queue[0]
			queue = queue[1:]
			for _, edge := range adjacency[current] {
				edgesByID[edge.ID] = edge
				next := edge.Left
				if next == current {
					next = edge.Right
				}
				if _, exists := visited[next]; !exists {
					visited[next] = struct{}{}
					queue = append(queue, next)
				}
			}
		}
		component := make([]stpEdge, 0, len(edgesByID))
		for _, edge := range edgesByID {
			component = append(component, edge)
		}
		slices.SortFunc(component, func(left, right stpEdge) int { return cmp.Compare(left.ID, right.ID) })
		if len(component) > 0 {
			components = append(components, component)
		}
	}
	return components
}

func simulateSTPComponent(vlanID, domain int, edges []stpEdge, bridges map[string]stpBridge, bridgeByDevice map[string]string) STPInstance {
	componentBridgeIDs := make(map[string]struct{})
	adjacency := make(map[string][]stpNeighbor)
	for _, edge := range edges {
		componentBridgeIDs[edge.Left] = struct{}{}
		componentBridgeIDs[edge.Right] = struct{}{}
		adjacency[edge.Left] = append(adjacency[edge.Left], stpNeighbor{BridgeID: edge.Right, Edge: edge})
		adjacency[edge.Right] = append(adjacency[edge.Right], stpNeighbor{BridgeID: edge.Left, Edge: edge})
	}
	bridgeIDs := make([]string, 0, len(componentBridgeIDs))
	for bridgeID := range componentBridgeIDs {
		bridgeIDs = append(bridgeIDs, bridgeID)
	}
	slices.SortFunc(bridgeIDs, func(left, right string) int { return compareSTPBridge(bridges[left], bridges[right]) })
	rootID := bridgeIDs[0]
	for bridgeID := range adjacency {
		slices.SortFunc(adjacency[bridgeID], func(left, right stpNeighbor) int {
			if result := cmp.Compare(left.Edge.ID, right.Edge.ID); result != 0 {
				return result
			}
			return cmp.Compare(left.BridgeID, right.BridgeID)
		})
	}
	distance := map[string]int{rootID: 0}
	parentBridge := make(map[string]string)
	parentEdge := make(map[string]string)
	edgesByID := make(map[string]stpEdge, len(edges))
	for _, edge := range edges {
		edgesByID[edge.ID] = edge
	}
	queue := []string{rootID}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, neighbor := range adjacency[current] {
			if _, seen := distance[neighbor.BridgeID]; seen {
				continue
			}
			distance[neighbor.BridgeID] = distance[current] + 1
			parentBridge[neighbor.BridgeID] = current
			parentEdge[neighbor.BridgeID] = neighbor.Edge.ID
			queue = append(queue, neighbor.BridgeID)
		}
	}
	instance := STPInstance{VLANID: vlanID, Domain: domain, RootBridgeID: rootID, RootName: bridges[rootID].Name}
	for _, bridgeID := range bridgeIDs {
		bridge := bridges[bridgeID]
		rootPorts := []string{}
		if edgeID := parentEdge[bridgeID]; edgeID != "" {
			for _, link := range edgesByID[edgeID].Links {
				if bridgeByDevice[link.SourceDeviceID] == bridgeID {
					rootPorts = append(rootPorts, link.SourcePortID)
				} else if bridgeByDevice[link.TargetDeviceID] == bridgeID {
					rootPorts = append(rootPorts, link.TargetPortID)
				}
			}
		}
		slices.Sort(rootPorts)
		instance.Bridges = append(instance.Bridges, STPBridgeState{
			BridgeID: bridgeID, Name: bridge.Name, DeviceIDs: slices.Clone(bridge.DeviceIDs), Priority: bridge.Priority,
			RootPathCost: distance[bridgeID], RootPortIDs: rootPorts,
		})
		instance.Paths = append(instance.Paths, buildSTPPath(bridgeID, rootID, parentBridge, parentEdge, edgesByID))
	}
	for _, edge := range edges {
		leftRole, rightRole := stpEdgeRoles(edge, parentBridge, parentEdge, distance, bridges)
		for _, link := range edge.Links {
			instance.Ports = append(instance.Ports,
				stpPhysicalPortState(link.SourcePortID, link.SourceDeviceID, link.ID, edge.GroupID, bridgeByDevice, edge, leftRole, rightRole),
				stpPhysicalPortState(link.TargetPortID, link.TargetDeviceID, link.ID, edge.GroupID, bridgeByDevice, edge, leftRole, rightRole),
			)
		}
	}
	slices.SortFunc(instance.Ports, func(left, right STPPortState) int {
		if result := cmp.Compare(left.LinkID, right.LinkID); result != 0 {
			return result
		}
		return cmp.Compare(left.PortID, right.PortID)
	})
	return instance
}

func compareSTPBridge(left, right stpBridge) int {
	if result := cmp.Compare(left.Priority, right.Priority); result != 0 {
		return result
	}
	return cmp.Compare(left.ID, right.ID)
}

func stpEdgeRoles(edge stpEdge, parentBridge map[string]string, parentEdge map[string]string, distance map[string]int, bridges map[string]stpBridge) (string, string) {
	if parentEdge[edge.Left] == edge.ID && parentBridge[edge.Left] == edge.Right {
		return STPRoleRoot, STPRoleDesignated
	}
	if parentEdge[edge.Right] == edge.ID && parentBridge[edge.Right] == edge.Left {
		return STPRoleDesignated, STPRoleRoot
	}
	leftWins := distance[edge.Left] < distance[edge.Right]
	if distance[edge.Left] == distance[edge.Right] {
		leftWins = compareSTPBridge(bridges[edge.Left], bridges[edge.Right]) < 0
	}
	if leftWins {
		return STPRoleDesignated, STPRoleBlocked
	}
	return STPRoleBlocked, STPRoleDesignated
}

func stpPhysicalPortState(portID, deviceID, linkID, groupID string, bridgeByDevice map[string]string, edge stpEdge, leftRole, rightRole string) STPPortState {
	bridgeID := bridgeByDevice[deviceID]
	role := leftRole
	peer := edge.Right
	if bridgeID == edge.Right {
		role = rightRole
		peer = edge.Left
	}
	state := STPStateForwarding
	if role == STPRoleBlocked {
		state = STPStateBlocking
	}
	return STPPortState{
		PortID: portID, DeviceID: deviceID, LinkID: linkID, GroupID: groupID,
		LogicalBridgeID: bridgeID, PeerBridgeID: peer, Role: role, State: state,
	}
}

func buildSTPPath(bridgeID, rootID string, parentBridge, parentEdge map[string]string, edges map[string]stpEdge) STPPath {
	path := STPPath{BridgeID: bridgeID, BridgeIDs: []string{bridgeID}, LinkIDs: []string{}}
	current := bridgeID
	for current != rootID {
		edgeID, exists := parentEdge[current]
		if !exists {
			break
		}
		for _, link := range edges[edgeID].Links {
			path.LinkIDs = append(path.LinkIDs, link.ID)
		}
		current = parentBridge[current]
		path.BridgeIDs = append(path.BridgeIDs, current)
	}
	return path
}
