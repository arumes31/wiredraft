// Package handler exposes the versioned HTTP API and embedded web application.
package handler

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"mime"
	"net/http"
	"path"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"time"

	"netdiagram/internal/auth"
	"netdiagram/internal/model"
	"netdiagram/internal/sse"
	"netdiagram/internal/store"
)

// Server coordinates HTTP handlers with persistence and event delivery.
type Server struct {
	store  store.Store
	broker *sse.Broker
	logger *slog.Logger
	static fs.FS
	auth   *auth.Manager
}

// New creates the complete application handler.
func New(
	topologyStore store.Store,
	broker *sse.Broker,
	logger *slog.Logger,
	static fs.FS,
) http.Handler {
	return newHandler(topologyStore, broker, logger, static, nil)
}

// NewWithAuth creates the application handler with local authentication and
// organization-scoped topology authorization enabled.
func NewWithAuth(
	topologyStore store.Store,
	broker *sse.Broker,
	logger *slog.Logger,
	static fs.FS,
	authManager *auth.Manager,
) http.Handler {
	return newHandler(topologyStore, broker, logger, static, authManager)
}

func newHandler(
	topologyStore store.Store,
	broker *sse.Broker,
	logger *slog.Logger,
	static fs.FS,
	authManager *auth.Manager,
) http.Handler {
	server := &Server{store: topologyStore, broker: broker, logger: logger, static: static, auth: authManager}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", server.health)
	if authManager != nil {
		mux.HandleFunc("GET /api/v1/auth/status", server.authStatus)
		mux.HandleFunc("POST /api/v1/auth/login", server.sameOrigin(server.login))
		mux.HandleFunc("POST /api/v1/auth/totp", server.sameOrigin(server.verifyTOTP))
		mux.HandleFunc("POST /api/v1/auth/setup", server.sameOrigin(server.completeTOTPSetup))
		mux.HandleFunc("POST /api/v1/auth/recovery", server.sameOrigin(server.verifyRecoveryCode))
		mux.HandleFunc("POST /api/v1/auth/guest", server.sameOrigin(server.guestLogin))
		mux.HandleFunc("POST /api/v1/auth/logout", server.protected(server.logout))
		mux.HandleFunc("GET /api/v1/admin/users", server.adminOnly(server.listUsers))
		mux.HandleFunc("POST /api/v1/admin/users", server.adminOnly(server.createUser))
		mux.HandleFunc("PUT /api/v1/admin/users/{userId}", server.adminOnly(server.updateUser))
	}
	protected := func(pattern string, handler http.HandlerFunc) {
		if authManager != nil {
			handler = server.protected(handler)
		}
		mux.HandleFunc(pattern, handler)
	}
	protected("GET /api/v1/topologies", server.listTopologies)
	protected("POST /api/v1/topologies", server.createTopology)
	protected("GET /api/v1/topologies/{id}", server.getTopology)
	protected("PUT /api/v1/topologies/{id}", server.replaceTopology)
	protected("POST /api/v1/topologies/{id}/racks", server.createRack)
	protected("PUT /api/v1/topologies/{id}/racks/{rackId}", server.updateRack)
	protected("DELETE /api/v1/topologies/{id}/racks/{rackId}", server.deleteRack)
	protected("POST /api/v1/topologies/{id}/devices", server.createDevice)
	protected("PUT /api/v1/topologies/{id}/devices/{deviceId}", server.updateDevice)
	protected("DELETE /api/v1/topologies/{id}/devices/{deviceId}", server.deleteDevice)
	protected("PUT /api/v1/topologies/{id}/ports/{portId}", server.updatePort)
	protected("POST /api/v1/topologies/{id}/links", server.createLink)
	protected("POST /api/v1/topologies/{id}/links/bulk", server.createLinks)
	protected("PUT /api/v1/topologies/{id}/links/{linkId}/configuration", server.configureLink)
	protected("PUT /api/v1/topologies/{id}/links/{linkId}/direction", server.setLinkDirection)
	protected("DELETE /api/v1/topologies/{id}/links/{linkId}", server.deleteLink)
	protected("POST /api/v1/topologies/{id}/link-groups", server.createLinkGroup)
	protected("PUT /api/v1/topologies/{id}/link-groups/{groupId}", server.updateLinkGroup)
	protected("DELETE /api/v1/topologies/{id}/link-groups/{groupId}", server.deleteLinkGroup)
	protected("POST /api/v1/topologies/{id}/switch-systems", server.createSwitchSystem)
	protected("PUT /api/v1/topologies/{id}/switch-systems/{systemId}", server.updateSwitchSystem)
	protected("DELETE /api/v1/topologies/{id}/switch-systems/{systemId}", server.deleteSwitchSystem)
	protected("POST /api/v1/topologies/{id}/firewall-clusters", server.createFirewallCluster)
	protected("PUT /api/v1/topologies/{id}/firewall-clusters/{clusterId}", server.updateFirewallCluster)
	protected("DELETE /api/v1/topologies/{id}/firewall-clusters/{clusterId}", server.deleteFirewallCluster)
	protected("GET /api/v1/topologies/{id}/vlans", server.listVLANs)
	protected("POST /api/v1/topologies/{id}/vlans", server.createVLAN)
	protected("PUT /api/v1/topologies/{id}/vlans/{vlanId}", server.updateVLAN)
	protected("DELETE /api/v1/topologies/{id}/vlans/{vlanId}", server.deleteVLAN)
	protected("GET /api/v1/topologies/{id}/analysis", server.analysis)
	protected("GET /api/v1/topologies/{id}/trace", server.trace)
	protected("GET /api/v1/topologies/{id}/events", server.events)
	protected("GET /api/v1/topologies/{id}/comments", server.listCommentThreads)
	protected("POST /api/v1/topologies/{id}/comments", server.createCommentThread)
	protected("POST /api/v1/topologies/{id}/comments/{threadId}/replies", server.createCommentReply)
	protected("PUT /api/v1/topologies/{id}/comments/{threadId}", server.updateCommentThread)
	protected("DELETE /api/v1/topologies/{id}/comments/{threadId}", server.deleteCommentThread)
	protected("GET /api/v1/topologies/{id}/documentation-links", server.listDocumentationLinks)
	protected("POST /api/v1/topologies/{id}/documentation-links", server.createDocumentationLink)
	protected("DELETE /api/v1/topologies/{id}/documentation-links/{linkId}", server.deleteDocumentationLink)
	protected("GET /api/v1/topologies/{id}/shares", server.listShareGrants)
	protected("POST /api/v1/topologies/{id}/shares", server.createShareGrant)
	protected("DELETE /api/v1/topologies/{id}/shares/{shareId}", server.deleteShareGrant)
	mux.HandleFunc("GET /api/v1/shared/{id}/{token}", server.getSharedTopology)
	if authManager != nil {
		mux.HandleFunc("GET /login", server.loginPage)
	}
	mux.HandleFunc("GET /{path...}", server.staticFile)
	return middleware(mux, logger)
}

func (s *Server) health(w http.ResponseWriter, request *http.Request) {
	if checker, ok := s.store.(interface{ Ping(context.Context) error }); ok {
		if err := checker.Ping(request.Context()); err != nil {
			s.fail(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "go_version": runtime.Version()})
}

func (s *Server) listTopologies(w http.ResponseWriter, request *http.Request) {
	summaries, err := s.store.List(request.Context())
	if err != nil {
		s.fail(w, err)
		return
	}
	if s.auth != nil {
		principal := principalFromRequest(request)
		summaries = slices.DeleteFunc(summaries, func(summary model.Summary) bool {
			return !s.auth.CanAccessTopology(principal, summary.ID, summary.Organization)
		})
	}
	writeJSON(w, http.StatusOK, summaries)
}

type createTopologyRequest struct {
	Name         string `json:"name"`
	Organization string `json:"organization"`
	Location     string `json:"location"`
	Template     string `json:"template"`
}

func (s *Server) createTopology(w http.ResponseWriter, request *http.Request) {
	var input createTopologyRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	var topology model.Topology
	var err error
	if strings.EqualFold(input.Template, "demo") {
		topology, err = model.NewDemo()
	} else {
		topology, err = newBlankTopology(input.Name)
	}
	if err != nil {
		s.fail(w, err)
		return
	}
	if strings.TrimSpace(input.Name) != "" {
		topology.Name = strings.TrimSpace(input.Name)
	}
	topology.Organization = strings.TrimSpace(input.Organization)
	topology.Location = strings.TrimSpace(input.Location)
	if s.auth != nil {
		principal := principalFromRequest(request)
		if principal.IsGuest() {
			topology.Organization = "Guest"
			if topology.Location == "" {
				topology.Location = "Guest Workspace"
			}
		} else if !s.auth.CanCreateInOrganization(principal, topology.Organization) {
			writeError(w, http.StatusForbidden, "organization access denied")
			return
		}
		if principal.IsGuest() {
			if err := s.auth.AddGuestTopology(request.Context(), topology.ID); err != nil {
				s.fail(w, err)
				return
			}
		}
	}
	created, err := s.store.Create(request.Context(), topology)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) getTopology(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.Context(), request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	w.Header().Set("ETag", topologyRevisionETag(topology.Revision))
	writeJSON(w, http.StatusOK, topology)
}

func (s *Server) replaceTopology(w http.ResponseWriter, request *http.Request) {
	var input model.Topology
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid topology")
		return
	}
	id := request.PathValue("id")
	if s.auth != nil {
		principal := principalFromRequest(request)
		if !principal.IsGuest() && !s.auth.CanCreateInOrganization(principal, input.Organization) {
			writeError(w, http.StatusForbidden, "organization access denied")
			return
		}
	}
	updated, err := s.mutate(request, id, func(current *model.Topology) error {
		if input.ID != id {
			return fmt.Errorf("%w: topology id does not match request path", store.ErrInvalid)
		}
		createdAt := current.CreatedAt
		organization := current.Organization
		*current = input
		current.CreatedAt = createdAt
		if s.auth != nil && principalFromRequest(request).IsGuest() {
			current.Organization = organization
		}
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "topology_updated", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) createRack(w http.ResponseWriter, request *http.Request) {
	var rack model.Rack
	if err := decodeJSON(w, request, &rack); err != nil {
		writeError(w, http.StatusBadRequest, "invalid rack")
		return
	}
	if rack.ID == "" {
		id, err := model.NewID()
		if err != nil {
			s.fail(w, err)
			return
		}
		rack.ID = id
	}
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		topology.Racks = append(topology.Racks, rack)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "rack_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) updateRack(w http.ResponseWriter, request *http.Request) {
	var rack model.Rack
	if err := decodeJSON(w, request, &rack); err != nil {
		writeError(w, http.StatusBadRequest, "invalid rack")
		return
	}
	rack.ID = request.PathValue("rackId")
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.Racks, func(current model.Rack) bool { return current.ID == rack.ID })
		if index < 0 {
			return store.ErrNotFound
		}
		topology.Racks[index] = rack
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "rack_updated", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteRack(w http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	rackID := request.PathValue("rackId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.Racks, func(rack model.Rack) bool { return rack.ID == rackID })
		if index < 0 {
			return store.ErrNotFound
		}
		rack := topology.Racks[index]
		for deviceIndex := range topology.Devices {
			device := &topology.Devices[deviceIndex]
			if device.RackID != rackID {
				continue
			}
			device.PositionX, device.PositionY = mountedDevicePosition(rack, *device)
			device.RackID = ""
			device.RackUnit = 0
		}
		topology.Racks = append(topology.Racks[:index], topology.Racks[index+1:]...)
		pruneAttachedPlanReferences(topology)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "rack_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) createDevice(w http.ResponseWriter, request *http.Request) {
	var device model.Device
	if err := decodeJSON(w, request, &device); err != nil {
		writeError(w, http.StatusBadRequest, "invalid device")
		return
	}
	if err := ensureDeviceIDs(&device); err != nil {
		s.fail(w, err)
		return
	}
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		topology.Devices = append(topology.Devices, device)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "device_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) updateDevice(w http.ResponseWriter, request *http.Request) {
	var device model.Device
	if err := decodeJSON(w, request, &device); err != nil {
		writeError(w, http.StatusBadRequest, "invalid device")
		return
	}
	device.ID = request.PathValue("deviceId")
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		for index := range topology.Devices {
			if topology.Devices[index].ID == device.ID {
				if err := ensureDeviceIDs(&device); err != nil {
					return err
				}
				topology.Devices[index] = device
				return nil
			}
		}
		return store.ErrNotFound
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "device_moved", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteDevice(w http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	deviceID := request.PathValue("deviceId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.Devices, func(device model.Device) bool { return device.ID == deviceID })
		if index < 0 {
			return store.ErrNotFound
		}
		topology.Devices = append(topology.Devices[:index], topology.Devices[index+1:]...)
		links := topology.Links[:0]
		for _, link := range topology.Links {
			if link.SourceDeviceID != deviceID && link.TargetDeviceID != deviceID {
				links = append(links, link)
			}
		}
		topology.Links = links
		pruneLinkGroups(topology)
		pruneSwitchSystems(topology)
		pruneFirewallClusters(topology)
		pruneAttachedPlanReferences(topology)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "device_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) updatePort(w http.ResponseWriter, request *http.Request) {
	var input model.Port
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid port")
		return
	}
	portID := request.PathValue("portId")
	input.ID = portID
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		for deviceIndex := range topology.Devices {
			for portIndex := range topology.Devices[deviceIndex].Ports {
				port := &topology.Devices[deviceIndex].Ports[portIndex]
				if port.ID == portID {
					input.DeviceID = topology.Devices[deviceIndex].ID
					input.PortIndex = port.PortIndex
					*port = input
					return nil
				}
			}
		}
		return store.ErrNotFound
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "port_updated", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) createLink(w http.ResponseWriter, request *http.Request) {
	var link model.Link
	if err := decodeJSON(w, request, &link); err != nil {
		writeError(w, http.StatusBadRequest, "invalid link")
		return
	}
	if link.ID == "" {
		var err error
		link.ID, err = model.NewID()
		if err != nil {
			s.fail(w, err)
			return
		}
	}
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		topology.Links = append(topology.Links, link)
		activateLinkEndpointPorts(topology, link)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

const maximumBulkLinks = 96

type createLinksRequest struct {
	Links []model.Link `json:"links"`
}

// createLinks adds a physical range mapping as one topology mutation. If one
// endpoint is invalid or occupied, validation rejects the complete batch.
func (s *Server) createLinks(w http.ResponseWriter, request *http.Request) {
	var input createLinksRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid link batch")
		return
	}
	if len(input.Links) == 0 || len(input.Links) > maximumBulkLinks {
		writeError(w, http.StatusBadRequest, "link batch must contain between 1 and 96 cables")
		return
	}
	for index := range input.Links {
		if input.Links[index].ID != "" {
			continue
		}
		id, err := model.NewID()
		if err != nil {
			s.fail(w, err)
			return
		}
		input.Links[index].ID = id
	}

	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		topology.Links = append(topology.Links, input.Links...)
		for _, link := range input.Links {
			activateLinkEndpointPorts(topology, link)
		}
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "links_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func activateLinkEndpointPorts(topology *model.Topology, link model.Link) {
	frontPortIDs := make(map[string]struct{}, 2)
	if link.EffectiveSourceSide() == model.LinkEndpointSideFront {
		frontPortIDs[link.SourcePortID] = struct{}{}
	}
	if link.EffectiveTargetSide() == model.LinkEndpointSideFront {
		frontPortIDs[link.TargetPortID] = struct{}{}
	}
	for deviceIndex := range topology.Devices {
		for portIndex := range topology.Devices[deviceIndex].Ports {
			port := &topology.Devices[deviceIndex].Ports[portIndex]
			if _, connected := frontPortIDs[port.ID]; connected {
				port.Status = model.PortStatusUp
			}
		}
	}
}

type linkConfigurationRequest struct {
	Mode         model.PortMode `json:"mode"`
	NativeVLAN   int            `json:"nativeVlan"`
	AllowedVLANs []int          `json:"allowedVlans"`
	CableType    string         `json:"cableType,omitempty"`
}

func (s *Server) configureLink(w http.ResponseWriter, request *http.Request) {
	var input linkConfigurationRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid link configuration")
		return
	}
	id := request.PathValue("id")
	linkID := request.PathValue("linkId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		return applyLinkConfiguration(topology, linkID, input)
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_configured", updated)
	writeJSON(w, http.StatusOK, updated)
}

func applyLinkConfiguration(
	topology *model.Topology,
	linkID string,
	input linkConfigurationRequest,
) error {
	selectedLinkIndex := slicesIndex(topology.Links, func(link model.Link) bool { return link.ID == linkID })
	if selectedLinkIndex < 0 {
		return store.ErrNotFound
	}
	if topology.Links[selectedLinkIndex].IsRearPanelConnection() {
		return fmt.Errorf("%w: rear panel mappings do not carry switchport configuration", store.ErrInvalid)
	}
	if !slices.Contains([]model.PortMode{model.PortModeAccess, model.PortModeTrunk, model.PortModeHybrid}, input.Mode) {
		return fmt.Errorf("%w: unsupported link port mode %q", store.ErrInvalid, input.Mode)
	}

	allowedVLANs := slices.Clone(input.AllowedVLANs)
	slices.Sort(allowedVLANs)
	allowedVLANs = slices.Compact(allowedVLANs)
	allowedVLANs = slices.DeleteFunc(allowedVLANs, func(vlanID int) bool {
		return vlanID == input.NativeVLAN
	})
	if input.Mode == model.PortModeAccess {
		allowedVLANs = []int{}
	}

	targetLinkIDs := []string{linkID}
	for _, group := range topology.LinkGroups {
		if slices.Contains(group.LinkIDs, linkID) {
			targetLinkIDs = slices.Clone(group.LinkIDs)
			break
		}
	}

	linksByID := make(map[string]int, len(topology.Links))
	for index, link := range topology.Links {
		linksByID[link.ID] = index
	}
	linkIndexes := make([]int, 0, len(targetLinkIDs))
	portIDs := make(map[string]struct{}, len(targetLinkIDs)*2)
	for _, targetLinkID := range targetLinkIDs {
		index, exists := linksByID[targetLinkID]
		if !exists {
			return fmt.Errorf("%w: link group member %q does not exist", store.ErrInvalid, targetLinkID)
		}
		linkIndexes = append(linkIndexes, index)
		link := topology.Links[index]
		portIDs[link.SourcePortID] = struct{}{}
		portIDs[link.TargetPortID] = struct{}{}
	}

	type portLocation struct {
		deviceIndex int
		portIndex   int
	}
	portLocations := make([]portLocation, 0, len(portIDs))
	for deviceIndex := range topology.Devices {
		for portIndex := range topology.Devices[deviceIndex].Ports {
			portID := topology.Devices[deviceIndex].Ports[portIndex].ID
			if _, exists := portIDs[portID]; exists {
				portLocations = append(portLocations, portLocation{deviceIndex: deviceIndex, portIndex: portIndex})
			}
		}
	}
	if len(portLocations) != len(portIDs) {
		return fmt.Errorf("%w: link group endpoints are incomplete", store.ErrInvalid)
	}

	for _, location := range portLocations {
		port := &topology.Devices[location.deviceIndex].Ports[location.portIndex]
		port.Mode = input.Mode
		port.NativeVLAN = input.NativeVLAN
		port.AllowedVLANs = slices.Clone(allowedVLANs)
	}
	for _, linkIndex := range linkIndexes {
		link := &topology.Links[linkIndex]
		if strings.TrimSpace(input.CableType) != "" {
			link.CableType = strings.TrimSpace(input.CableType)
		}
		link.PrimaryVLAN = input.NativeVLAN
		link.VLANIDs = append([]int{input.NativeVLAN}, allowedVLANs...)
	}
	return nil
}

type linkDirectionRequest struct {
	SourcePortID string `json:"sourcePortId"`
}

func (s *Server) setLinkDirection(w http.ResponseWriter, request *http.Request) {
	var input linkDirectionRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid link direction")
		return
	}
	id := request.PathValue("id")
	linkID := request.PathValue("linkId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		return applyLinkDirection(topology, linkID, input)
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_direction_updated", updated)
	writeJSON(w, http.StatusOK, updated)
}

func applyLinkDirection(topology *model.Topology, linkID string, input linkDirectionRequest) error {
	linkIndex := slicesIndex(topology.Links, func(link model.Link) bool { return link.ID == linkID })
	if linkIndex < 0 {
		return store.ErrNotFound
	}
	link := &topology.Links[linkIndex]
	if input.SourcePortID == link.SourcePortID {
		return nil
	}
	if input.SourcePortID != link.TargetPortID {
		return fmt.Errorf("%w: source port must be a current link endpoint", store.ErrInvalid)
	}

	link.SourceDeviceID, link.TargetDeviceID = link.TargetDeviceID, link.SourceDeviceID
	link.SourcePortID, link.TargetPortID = link.TargetPortID, link.SourcePortID
	link.SourceSide, link.TargetSide = link.TargetSide, link.SourceSide
	return nil
}

func (s *Server) deleteLink(w http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	linkID := request.PathValue("linkId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.Links, func(link model.Link) bool { return link.ID == linkID })
		if index < 0 {
			return store.ErrNotFound
		}
		removedLink := topology.Links[index]
		topology.Links = append(topology.Links[:index], topology.Links[index+1:]...)
		deactivateUnlinkedEndpointPorts(topology, removedLink)
		pruneLinkGroups(topology)
		pruneAttachedPlanReferences(topology)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

func deactivateUnlinkedEndpointPorts(topology *model.Topology, removedLink model.Link) {
	unlinkedPortIDs := make(map[string]struct{}, 2)
	if removedLink.EffectiveSourceSide() == model.LinkEndpointSideFront {
		unlinkedPortIDs[removedLink.SourcePortID] = struct{}{}
	}
	if removedLink.EffectiveTargetSide() == model.LinkEndpointSideFront {
		unlinkedPortIDs[removedLink.TargetPortID] = struct{}{}
	}
	for _, link := range topology.Links {
		if link.EffectiveSourceSide() == model.LinkEndpointSideFront {
			delete(unlinkedPortIDs, link.SourcePortID)
		}
		if link.EffectiveTargetSide() == model.LinkEndpointSideFront {
			delete(unlinkedPortIDs, link.TargetPortID)
		}
	}
	if len(unlinkedPortIDs) == 0 {
		return
	}
	for deviceIndex := range topology.Devices {
		for portIndex := range topology.Devices[deviceIndex].Ports {
			port := &topology.Devices[deviceIndex].Ports[portIndex]
			if _, isUnlinked := unlinkedPortIDs[port.ID]; isUnlinked {
				port.Status = model.PortStatusDown
			}
		}
	}
}

func (s *Server) createLinkGroup(w http.ResponseWriter, request *http.Request) {
	var group model.LinkGroup
	if err := decodeJSON(w, request, &group); err != nil {
		writeError(w, http.StatusBadRequest, "invalid link group")
		return
	}
	if group.ID == "" {
		var err error
		group.ID, err = model.NewID()
		if err != nil {
			s.fail(w, err)
			return
		}
	}
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		topology.LinkGroups = append(topology.LinkGroups, group)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_group_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) updateLinkGroup(w http.ResponseWriter, request *http.Request) {
	var group model.LinkGroup
	if err := decodeJSON(w, request, &group); err != nil {
		writeError(w, http.StatusBadRequest, "invalid link group")
		return
	}
	group.ID = request.PathValue("groupId")
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.LinkGroups, func(current model.LinkGroup) bool { return current.ID == group.ID })
		if index < 0 {
			return store.ErrNotFound
		}
		topology.LinkGroups[index] = group
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_group_updated", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteLinkGroup(w http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	groupID := request.PathValue("groupId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.LinkGroups, func(group model.LinkGroup) bool { return group.ID == groupID })
		if index < 0 {
			return store.ErrNotFound
		}
		topology.LinkGroups = append(topology.LinkGroups[:index], topology.LinkGroups[index+1:]...)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_group_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) createSwitchSystem(w http.ResponseWriter, request *http.Request) {
	var system model.SwitchSystem
	if err := decodeJSON(w, request, &system); err != nil {
		writeError(w, http.StatusBadRequest, "invalid switch system")
		return
	}
	if system.ID == "" {
		var err error
		system.ID, err = model.NewID()
		if err != nil {
			s.fail(w, err)
			return
		}
	}
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		topology.SwitchSystems = append(topology.SwitchSystems, system)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "switch_system_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) updateSwitchSystem(w http.ResponseWriter, request *http.Request) {
	var system model.SwitchSystem
	if err := decodeJSON(w, request, &system); err != nil {
		writeError(w, http.StatusBadRequest, "invalid switch system")
		return
	}
	system.ID = request.PathValue("systemId")
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.SwitchSystems, func(current model.SwitchSystem) bool {
			return current.ID == system.ID
		})
		if index < 0 {
			return store.ErrNotFound
		}
		topology.SwitchSystems[index] = system
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "switch_system_updated", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteSwitchSystem(w http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	systemID := request.PathValue("systemId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.SwitchSystems, func(system model.SwitchSystem) bool {
			return system.ID == systemID
		})
		if index < 0 {
			return store.ErrNotFound
		}
		topology.SwitchSystems = append(topology.SwitchSystems[:index], topology.SwitchSystems[index+1:]...)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "switch_system_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) createFirewallCluster(w http.ResponseWriter, request *http.Request) {
	var cluster model.FirewallCluster
	if err := decodeJSON(w, request, &cluster); err != nil {
		writeError(w, http.StatusBadRequest, "invalid firewall cluster")
		return
	}
	if cluster.ID == "" {
		var err error
		cluster.ID, err = model.NewID()
		if err != nil {
			s.fail(w, err)
			return
		}
	}
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		topology.FirewallClusters = append(topology.FirewallClusters, cluster)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "firewall_cluster_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) updateFirewallCluster(w http.ResponseWriter, request *http.Request) {
	var cluster model.FirewallCluster
	if err := decodeJSON(w, request, &cluster); err != nil {
		writeError(w, http.StatusBadRequest, "invalid firewall cluster")
		return
	}
	cluster.ID = request.PathValue("clusterId")
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.FirewallClusters, func(current model.FirewallCluster) bool {
			return current.ID == cluster.ID
		})
		if index < 0 {
			return store.ErrNotFound
		}
		topology.FirewallClusters[index] = cluster
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "firewall_cluster_updated", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteFirewallCluster(w http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	clusterID := request.PathValue("clusterId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.FirewallClusters, func(cluster model.FirewallCluster) bool {
			return cluster.ID == clusterID
		})
		if index < 0 {
			return store.ErrNotFound
		}
		topology.FirewallClusters = append(topology.FirewallClusters[:index], topology.FirewallClusters[index+1:]...)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "firewall_cluster_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) listVLANs(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.Context(), request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, topology.VLANs)
}

func (s *Server) createVLAN(w http.ResponseWriter, request *http.Request) {
	var vlan model.VLAN
	if err := decodeJSON(w, request, &vlan); err != nil {
		writeError(w, http.StatusBadRequest, "invalid vlan")
		return
	}
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		topology.VLANs = append(topology.VLANs, vlan)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "vlan_changed", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) updateVLAN(w http.ResponseWriter, request *http.Request) {
	var vlan model.VLAN
	if err := decodeJSON(w, request, &vlan); err != nil {
		writeError(w, http.StatusBadRequest, "invalid vlan")
		return
	}
	vlanID, err := strconv.Atoi(request.PathValue("vlanId"))
	if err != nil || vlan.ID != vlanID {
		writeError(w, http.StatusBadRequest, "vlan id does not match request path")
		return
	}
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.VLANs, func(current model.VLAN) bool { return current.ID == vlanID })
		if index < 0 {
			return store.ErrNotFound
		}
		topology.VLANs[index] = vlan
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "vlan_changed", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteVLAN(w http.ResponseWriter, request *http.Request) {
	vlanID, err := strconv.Atoi(request.PathValue("vlanId"))
	if err != nil || vlanID == 1 {
		writeError(w, http.StatusBadRequest, "vlan 1 cannot be deleted")
		return
	}
	id := request.PathValue("id")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slicesIndex(topology.VLANs, func(vlan model.VLAN) bool { return vlan.ID == vlanID })
		if index < 0 {
			return store.ErrNotFound
		}
		topology.VLANs = append(topology.VLANs[:index], topology.VLANs[index+1:]...)
		for deviceIndex := range topology.Devices {
			for portIndex := range topology.Devices[deviceIndex].Ports {
				port := &topology.Devices[deviceIndex].Ports[portIndex]
				if port.NativeVLAN == vlanID {
					port.NativeVLAN = 1
				}
				port.AllowedVLANs = removeInt(port.AllowedVLANs, vlanID)
			}
		}
		for linkIndex := range topology.Links {
			link := &topology.Links[linkIndex]
			link.VLANIDs = removeInt(link.VLANIDs, vlanID)
			if link.PrimaryVLAN == vlanID {
				link.PrimaryVLAN = 1
			}
		}
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "vlan_changed", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) analysis(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.Context(), request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, model.Analyze(topology))
}

func (s *Server) trace(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.Context(), request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	vlanID, err := strconv.Atoi(request.URL.Query().Get("vlan"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "vlan query parameter is required")
		return
	}
	links, err := model.TracePath(
		topology,
		request.URL.Query().Get("source"),
		request.URL.Query().Get("target"),
		vlanID,
	)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "no valid forwarding path")
		return
	}
	writeJSON(w, http.StatusOK, map[string][]string{"linkIds": links})
}

type createCommentThreadRequest struct {
	Anchor model.CommentAnchor `json:"anchor"`
	Author string              `json:"author"`
	Body   string              `json:"body"`
}

type createCommentReplyRequest struct {
	Author string `json:"author"`
	Body   string `json:"body"`
}

type updateCommentThreadRequest struct {
	Resolved bool `json:"resolved"`
}

func (s *Server) listCommentThreads(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.Context(), request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, topology.CommentThreads)
}

func (s *Server) createCommentThread(w http.ResponseWriter, request *http.Request) {
	var input createCommentThreadRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid comment thread")
		return
	}
	threadID, err := model.NewID()
	if err != nil {
		s.fail(w, err)
		return
	}
	messageID, err := model.NewID()
	if err != nil {
		s.fail(w, err)
		return
	}
	now := time.Now().UTC()
	thread := model.CommentThread{
		ID: threadID, Anchor: input.Anchor, CreatedAt: now, UpdatedAt: now,
		Messages: []model.CommentMessage{{
			ID: messageID, Author: strings.TrimSpace(input.Author), Body: strings.TrimSpace(input.Body), CreatedAt: now, UpdatedAt: now,
		}},
	}
	topologyID := request.PathValue("id")
	updated, err := s.mutate(request, topologyID, func(topology *model.Topology) error {
		topology.CommentThreads = append(topology.CommentThreads, thread)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(topologyID, "comment_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) createCommentReply(w http.ResponseWriter, request *http.Request) {
	var input createCommentReplyRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid comment reply")
		return
	}
	messageID, err := model.NewID()
	if err != nil {
		s.fail(w, err)
		return
	}
	now := time.Now().UTC()
	message := model.CommentMessage{ID: messageID, Author: strings.TrimSpace(input.Author), Body: strings.TrimSpace(input.Body), CreatedAt: now, UpdatedAt: now}
	topologyID := request.PathValue("id")
	threadID := request.PathValue("threadId")
	updated, err := s.mutate(request, topologyID, func(topology *model.Topology) error {
		for index := range topology.CommentThreads {
			if topology.CommentThreads[index].ID == threadID {
				topology.CommentThreads[index].Messages = append(topology.CommentThreads[index].Messages, message)
				topology.CommentThreads[index].UpdatedAt = now
				return nil
			}
		}
		return store.ErrNotFound
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(topologyID, "comment_replied", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) updateCommentThread(w http.ResponseWriter, request *http.Request) {
	var input updateCommentThreadRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid comment thread update")
		return
	}
	topologyID := request.PathValue("id")
	threadID := request.PathValue("threadId")
	updated, err := s.mutate(request, topologyID, func(topology *model.Topology) error {
		for index := range topology.CommentThreads {
			if topology.CommentThreads[index].ID == threadID {
				topology.CommentThreads[index].Resolved = input.Resolved
				topology.CommentThreads[index].UpdatedAt = time.Now().UTC()
				return nil
			}
		}
		return store.ErrNotFound
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(topologyID, "comment_updated", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteCommentThread(w http.ResponseWriter, request *http.Request) {
	topologyID := request.PathValue("id")
	threadID := request.PathValue("threadId")
	updated, err := s.mutate(request, topologyID, func(topology *model.Topology) error {
		for index, thread := range topology.CommentThreads {
			if thread.ID == threadID {
				topology.CommentThreads = slices.Delete(topology.CommentThreads, index, index+1)
				return nil
			}
		}
		return store.ErrNotFound
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(topologyID, "comment_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) listDocumentationLinks(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.Context(), request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, topology.DocumentationLinks)
}

func (s *Server) createDocumentationLink(w http.ResponseWriter, request *http.Request) {
	var documentationLink model.DocumentationLink
	if err := decodeJSON(w, request, &documentationLink); err != nil {
		writeError(w, http.StatusBadRequest, "invalid documentation link")
		return
	}
	if documentationLink.ID == "" {
		id, err := model.NewID()
		if err != nil {
			s.fail(w, err)
			return
		}
		documentationLink.ID = id
	}
	documentationLink.Label = strings.TrimSpace(documentationLink.Label)
	documentationLink.URL = strings.TrimSpace(documentationLink.URL)
	documentationLink.CreatedAt = time.Now().UTC()
	topologyID := request.PathValue("id")
	updated, err := s.mutate(request, topologyID, func(topology *model.Topology) error {
		topology.DocumentationLinks = append(topology.DocumentationLinks, documentationLink)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(topologyID, "documentation_link_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) deleteDocumentationLink(w http.ResponseWriter, request *http.Request) {
	topologyID := request.PathValue("id")
	documentationLinkID := request.PathValue("linkId")
	updated, err := s.mutate(request, topologyID, func(topology *model.Topology) error {
		for index, documentationLink := range topology.DocumentationLinks {
			if documentationLink.ID == documentationLinkID {
				topology.DocumentationLinks = slices.Delete(topology.DocumentationLinks, index, index+1)
				return nil
			}
		}
		return store.ErrNotFound
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(topologyID, "documentation_link_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

type createShareGrantRequest struct {
	Name      string     `json:"name"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

type shareGrantResponse struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Revision  uint64     `json:"revision,omitempty"`
	Path      string     `json:"path,omitempty"`
	Token     string     `json:"token,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

func (s *Server) listShareGrants(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.Context(), request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	shares := make([]shareGrantResponse, 0, len(topology.ShareGrants))
	for _, share := range topology.ShareGrants {
		shares = append(shares, shareGrantResponse{ID: share.ID, Name: share.Name, CreatedAt: share.CreatedAt, ExpiresAt: share.ExpiresAt})
	}
	writeJSON(w, http.StatusOK, shares)
}

func (s *Server) createShareGrant(w http.ResponseWriter, request *http.Request) {
	var input createShareGrantRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid share settings")
		return
	}
	shareID, err := model.NewID()
	if err != nil {
		s.fail(w, err)
		return
	}
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		s.fail(w, fmt.Errorf("generating share token: %w", err))
		return
	}
	token := base64.RawURLEncoding.EncodeToString(tokenBytes)
	digest := sha256.Sum256([]byte(token))
	now := time.Now().UTC()
	grant := model.ShareGrant{
		ID: shareID, Name: strings.TrimSpace(input.Name), TokenHash: hex.EncodeToString(digest[:]), CreatedAt: now, ExpiresAt: input.ExpiresAt,
	}
	if grant.Name == "" {
		grant.Name = "Read-only share"
	}
	topologyID := request.PathValue("id")
	updated, err := s.mutate(request, topologyID, func(topology *model.Topology) error {
		topology.ShareGrants = append(topology.ShareGrants, grant)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(topologyID, "share_created", updated)
	writeJSON(w, http.StatusCreated, shareGrantResponse{
		ID: grant.ID, Name: grant.Name, Token: token,
		Path:      "/api/v1/shared/" + topologyID + "/" + token,
		Revision:  updated.Revision,
		CreatedAt: grant.CreatedAt, ExpiresAt: grant.ExpiresAt,
	})
}

func (s *Server) deleteShareGrant(w http.ResponseWriter, request *http.Request) {
	topologyID := request.PathValue("id")
	shareID := request.PathValue("shareId")
	updated, err := s.mutate(request, topologyID, func(topology *model.Topology) error {
		for index, share := range topology.ShareGrants {
			if share.ID == shareID {
				topology.ShareGrants = slices.Delete(topology.ShareGrants, index, index+1)
				return nil
			}
		}
		return store.ErrNotFound
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(topologyID, "share_deleted", updated)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getSharedTopology(w http.ResponseWriter, request *http.Request) {
	token := request.PathValue("token")
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		writeError(w, http.StatusNotFound, "share link not found")
		return
	}
	topology, err := s.store.Get(request.Context(), request.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "share link not found")
		return
	}
	digest := sha256.Sum256([]byte(token))
	now := time.Now().UTC()
	granted := false
	for _, share := range topology.ShareGrants {
		expected, decodeErr := hex.DecodeString(share.TokenHash)
		matches := decodeErr == nil && len(expected) == len(digest) && subtle.ConstantTimeCompare(expected, digest[:]) == 1
		if matches && (share.ExpiresAt == nil || share.ExpiresAt.After(now)) {
			granted = true
		}
	}
	if !granted {
		writeError(w, http.StatusNotFound, "share link not found")
		return
	}
	topology.ShareGrants = []model.ShareGrant{}
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	writeJSON(w, http.StatusOK, topology)
}

func (s *Server) events(w http.ResponseWriter, request *http.Request) {
	if _, err := s.store.Get(request.Context(), request.PathValue("id")); err != nil {
		s.fail(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	controller := http.NewResponseController(w)
	if _, err := fmt.Fprint(w, ": connected\n\n"); err != nil {
		return
	}
	if err := controller.Flush(); err != nil {
		return
	}
	events, cancel := s.broker.Subscribe(request.PathValue("id"))
	defer cancel()
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case <-request.Context().Done():
			return
		case event, open := <-events:
			if !open {
				return
			}
			if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, event.Data); err != nil {
				return
			}
		case <-heartbeat.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
		}
		if err := controller.Flush(); err != nil {
			return
		}
	}
}

func (s *Server) staticFile(w http.ResponseWriter, request *http.Request) {
	requested := strings.TrimPrefix(path.Clean("/"+request.PathValue("path")), "/")
	if requested == "." || requested == "" {
		requested = "index.html"
	}
	if s.auth != nil && (requested == "index.html" || path.Ext(requested) == "") {
		if _, authenticated := s.sessionFromRequest(request); !authenticated {
			http.Redirect(w, request, "/login", http.StatusSeeOther)
			return
		}
	}
	data, err := fs.ReadFile(s.static, requested)
	if err != nil {
		requested = "index.html"
		if s.auth != nil {
			if _, authenticated := s.sessionFromRequest(request); !authenticated {
				http.Redirect(w, request, "/login", http.StatusSeeOther)
				return
			}
		}
		data, err = fs.ReadFile(s.static, requested)
	}
	if err != nil {
		writeError(w, http.StatusNotFound, "asset not found")
		return
	}
	s.serveStaticContent(w, request, requested, data)
}

func (s *Server) serveStaticAsset(w http.ResponseWriter, request *http.Request, requested string) {
	data, err := fs.ReadFile(s.static, requested)
	if err != nil {
		writeError(w, http.StatusNotFound, "asset not found")
		return
	}
	s.serveStaticContent(w, request, requested, data)
}

func (s *Server) serveStaticContent(w http.ResponseWriter, request *http.Request, requested string, data []byte) {
	contentType := mime.TypeByExtension(path.Ext(requested))
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeContent(w, request, requested, time.Time{}, strings.NewReader(string(data)))
}

func (s *Server) publish(id, eventType string, topology model.Topology) {
	if err := s.broker.Publish(id, eventType, topology); err != nil {
		s.logger.Error("publishing sse event", "event", eventType, "error", err)
	}
}

func (s *Server) mutate(request *http.Request, id string, mutation func(*model.Topology) error) (model.Topology, error) {
	expectedRevision, err := parseExpectedRevision(request.Header.Get("If-Match"))
	if err != nil {
		return model.Topology{}, fmt.Errorf("%w: %w", store.ErrInvalid, err)
	}
	return s.store.MutateAtRevision(request.Context(), id, expectedRevision, mutation)
}

func parseExpectedRevision(value string) (uint64, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, nil
	}
	value = strings.TrimPrefix(value, "W/")
	value = strings.Trim(value, "\"")
	value = strings.TrimPrefix(value, "rev-")
	revision, err := strconv.ParseUint(value, 10, 64)
	if err != nil || revision == 0 {
		return 0, errors.New("If-Match must contain a positive topology revision")
	}
	return revision, nil
}

func topologyRevisionETag(revision uint64) string {
	return fmt.Sprintf("\"rev-%d\"", revision)
}

func (s *Server) fail(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	message := "internal server error"
	switch {
	case errors.Is(err, store.ErrNotFound):
		status = http.StatusNotFound
		message = "resource not found"
	case errors.Is(err, store.ErrConflict):
		status = http.StatusConflict
		message = "resource already exists"
	case errors.Is(err, store.ErrInvalid):
		status = http.StatusBadRequest
		message = "request violates topology rules"
	}
	var revisionConflict *store.RevisionConflictError
	if errors.As(err, &revisionConflict) {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":            "topology changed since it was loaded",
			"expectedRevision": revisionConflict.Expected,
			"currentRevision":  revisionConflict.Actual,
		})
		return
	}
	if status >= 500 {
		s.logger.Error("http handler error", "error", err)
	}
	writeError(w, status, message)
}

func newBlankTopology(name string) (model.Topology, error) {
	id, err := model.NewID()
	if err != nil {
		return model.Topology{}, err
	}
	if strings.TrimSpace(name) == "" {
		name = "Untitled topology"
	}
	now := time.Now().UTC()
	return model.Topology{
		ID:               id,
		Name:             strings.TrimSpace(name),
		Racks:            []model.Rack{},
		Devices:          []model.Device{},
		Links:            []model.Link{},
		LinkGroups:       []model.LinkGroup{},
		SwitchSystems:    []model.SwitchSystem{},
		FirewallClusters: []model.FirewallCluster{},
		VLANs:            []model.VLAN{{ID: 1, Name: "Native", ColorHex: "#8a9ba8", Description: "Default untagged network"}},
		CreatedAt:        now,
		UpdatedAt:        now,
	}, nil
}

func pruneLinkGroups(topology *model.Topology) {
	linkIDs := make(map[string]struct{}, len(topology.Links))
	for _, link := range topology.Links {
		linkIDs[link.ID] = struct{}{}
	}
	groups := topology.LinkGroups[:0]
	for _, group := range topology.LinkGroups {
		members := group.LinkIDs[:0]
		for _, linkID := range group.LinkIDs {
			if _, exists := linkIDs[linkID]; exists {
				members = append(members, linkID)
			}
		}
		group.LinkIDs = members
		if len(group.LinkIDs) >= 2 {
			if group.Mode == model.LinkGroupModeFailover && !slices.Contains(group.LinkIDs, group.PrimaryLinkID) {
				group.PrimaryLinkID = group.LinkIDs[0]
			}
			groups = append(groups, group)
		}
	}
	topology.LinkGroups = groups
}

func pruneSwitchSystems(topology *model.Topology) {
	deviceIDs := make(map[string]struct{}, len(topology.Devices))
	for _, device := range topology.Devices {
		deviceIDs[device.ID] = struct{}{}
	}
	systems := topology.SwitchSystems[:0]
	for _, system := range topology.SwitchSystems {
		members := system.DeviceIDs[:0]
		for _, deviceID := range system.DeviceIDs {
			if _, exists := deviceIDs[deviceID]; exists {
				members = append(members, deviceID)
			}
		}
		system.DeviceIDs = members
		if len(system.DeviceIDs) >= 2 {
			systems = append(systems, system)
		}
	}
	topology.SwitchSystems = systems
}

func pruneFirewallClusters(topology *model.Topology) {
	deviceIDs := make(map[string]struct{}, len(topology.Devices))
	for _, device := range topology.Devices {
		deviceIDs[device.ID] = struct{}{}
	}
	clusters := topology.FirewallClusters[:0]
	for _, cluster := range topology.FirewallClusters {
		members := cluster.DeviceIDs[:0]
		for _, deviceID := range cluster.DeviceIDs {
			if _, exists := deviceIDs[deviceID]; exists {
				members = append(members, deviceID)
			}
		}
		cluster.DeviceIDs = members
		if len(cluster.DeviceIDs) < 2 {
			continue
		}
		if cluster.Mode == model.FirewallClusterModeActivePassive && !slices.Contains(cluster.DeviceIDs, cluster.ActiveDeviceID) {
			cluster.ActiveDeviceID = cluster.DeviceIDs[0]
		}
		clusters = append(clusters, cluster)
	}
	topology.FirewallClusters = clusters
}

func pruneAttachedPlanReferences(topology *model.Topology) {
	racks := make(map[string]struct{}, len(topology.Racks))
	devices := make(map[string]struct{}, len(topology.Devices))
	ports := make(map[string]struct{})
	links := make(map[string]struct{}, len(topology.Links))
	for _, rack := range topology.Racks {
		racks[rack.ID] = struct{}{}
	}
	for _, device := range topology.Devices {
		devices[device.ID] = struct{}{}
		for _, port := range device.Ports {
			ports[port.ID] = struct{}{}
		}
	}
	for _, link := range topology.Links {
		links[link.ID] = struct{}{}
	}
	threads := topology.CommentThreads[:0]
	for _, thread := range topology.CommentThreads {
		keep := thread.Anchor.Kind == model.CommentAnchorCanvas
		if thread.Anchor.Kind == model.CommentAnchorDevice {
			_, keep = devices[thread.Anchor.TargetID]
		}
		if thread.Anchor.Kind == model.CommentAnchorPort {
			_, keep = ports[thread.Anchor.TargetID]
		}
		if thread.Anchor.Kind == model.CommentAnchorLink {
			_, keep = links[thread.Anchor.TargetID]
		}
		if keep {
			threads = append(threads, thread)
		}
	}
	topology.CommentThreads = threads
	documentationLinks := topology.DocumentationLinks[:0]
	for _, documentationLink := range topology.DocumentationLinks {
		keep := documentationLink.TargetKind == model.DocumentationTargetTopology && documentationLink.TargetID == topology.ID
		switch documentationLink.TargetKind {
		case model.DocumentationTargetRack:
			_, keep = racks[documentationLink.TargetID]
		case model.DocumentationTargetDevice:
			_, keep = devices[documentationLink.TargetID]
		case model.DocumentationTargetPort:
			_, keep = ports[documentationLink.TargetID]
		case model.DocumentationTargetLink:
			_, keep = links[documentationLink.TargetID]
		}
		if keep {
			documentationLinks = append(documentationLinks, documentationLink)
		}
	}
	topology.DocumentationLinks = documentationLinks
}

func mountedDevicePosition(rack model.Rack, device model.Device) (float64, float64) {
	const (
		rackDeviceInset  = 30
		rackHeaderHeight = 64
		rackUnitHeight   = 100
	)
	x := rack.PositionX + rackDeviceInset
	topUnit := device.RackUnit + device.Faceplate.UnitsU - 1
	y := rack.PositionY + rackHeaderHeight + float64(rack.HeightU-topUnit)*rackUnitHeight
	return x, y
}

func ensureDeviceIDs(device *model.Device) error {
	if device.ID == "" {
		id, err := model.NewID()
		if err != nil {
			return err
		}
		device.ID = id
	}
	for index := range device.Ports {
		if device.Ports[index].ID == "" {
			id, err := model.NewID()
			if err != nil {
				return err
			}
			device.Ports[index].ID = id
		}
		device.Ports[index].DeviceID = device.ID
		device.Ports[index].PortIndex = index + 1
	}
	return nil
}

func slicesIndex[T any](values []T, matches func(T) bool) int {
	for index, value := range values {
		if matches(value) {
			return index
		}
	}
	return -1
}

func removeInt(values []int, target int) []int {
	result := values[:0]
	for _, value := range values {
		if value != target {
			result = append(result, value)
		}
	}
	return result
}
