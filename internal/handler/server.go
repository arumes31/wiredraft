// Package handler exposes the versioned HTTP API and embedded web application.
package handler

import (
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"mime"
	"net/http"
	"path"
	"runtime"
	"strconv"
	"strings"
	"time"

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
}

// New creates the complete application handler.
func New(
	topologyStore store.Store,
	broker *sse.Broker,
	logger *slog.Logger,
	static fs.FS,
) http.Handler {
	server := &Server{store: topologyStore, broker: broker, logger: logger, static: static}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", server.health)
	mux.HandleFunc("GET /api/v1/topologies", server.listTopologies)
	mux.HandleFunc("POST /api/v1/topologies", server.createTopology)
	mux.HandleFunc("GET /api/v1/topologies/{id}", server.getTopology)
	mux.HandleFunc("PUT /api/v1/topologies/{id}", server.replaceTopology)
	mux.HandleFunc("POST /api/v1/topologies/{id}/devices", server.createDevice)
	mux.HandleFunc("PUT /api/v1/topologies/{id}/devices/{deviceId}", server.updateDevice)
	mux.HandleFunc("DELETE /api/v1/topologies/{id}/devices/{deviceId}", server.deleteDevice)
	mux.HandleFunc("PUT /api/v1/topologies/{id}/ports/{portId}", server.updatePort)
	mux.HandleFunc("POST /api/v1/topologies/{id}/links", server.createLink)
	mux.HandleFunc("DELETE /api/v1/topologies/{id}/links/{linkId}", server.deleteLink)
	mux.HandleFunc("GET /api/v1/topologies/{id}/vlans", server.listVLANs)
	mux.HandleFunc("POST /api/v1/topologies/{id}/vlans", server.createVLAN)
	mux.HandleFunc("PUT /api/v1/topologies/{id}/vlans/{vlanId}", server.updateVLAN)
	mux.HandleFunc("DELETE /api/v1/topologies/{id}/vlans/{vlanId}", server.deleteVLAN)
	mux.HandleFunc("GET /api/v1/topologies/{id}/analysis", server.analysis)
	mux.HandleFunc("GET /api/v1/topologies/{id}/trace", server.trace)
	mux.HandleFunc("GET /api/v1/topologies/{id}/events", server.events)
	mux.HandleFunc("GET /{path...}", server.staticFile)
	return middleware(mux, logger)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "go_version": runtime.Version()})
}

func (s *Server) listTopologies(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.store.List())
}

type createTopologyRequest struct {
	Name     string `json:"name"`
	Template string `json:"template"`
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
	created, err := s.store.Create(topology)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) getTopology(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, topology)
}

func (s *Server) replaceTopology(w http.ResponseWriter, request *http.Request) {
	var input model.Topology
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid topology")
		return
	}
	id := request.PathValue("id")
	updated, err := s.store.Mutate(id, func(current *model.Topology) error {
		if input.ID != id {
			return fmt.Errorf("%w: topology id does not match request path", store.ErrInvalid)
		}
		createdAt := current.CreatedAt
		*current = input
		current.CreatedAt = createdAt
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "topology_updated", updated)
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
	updated, err := s.store.Mutate(id, func(topology *model.Topology) error {
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
	updated, err := s.store.Mutate(id, func(topology *model.Topology) error {
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
	updated, err := s.store.Mutate(id, func(topology *model.Topology) error {
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
	updated, err := s.store.Mutate(id, func(topology *model.Topology) error {
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
	updated, err := s.store.Mutate(id, func(topology *model.Topology) error {
		topology.Links = append(topology.Links, link)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_created", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func (s *Server) deleteLink(w http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	linkID := request.PathValue("linkId")
	updated, err := s.store.Mutate(id, func(topology *model.Topology) error {
		index := slicesIndex(topology.Links, func(link model.Link) bool { return link.ID == linkID })
		if index < 0 {
			return store.ErrNotFound
		}
		topology.Links = append(topology.Links[:index], topology.Links[index+1:]...)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) listVLANs(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.PathValue("id"))
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
	updated, err := s.store.Mutate(id, func(topology *model.Topology) error {
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
	updated, err := s.store.Mutate(id, func(topology *model.Topology) error {
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
	updated, err := s.store.Mutate(id, func(topology *model.Topology) error {
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
	topology, err := s.store.Get(request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, model.Analyze(topology))
}

func (s *Server) trace(w http.ResponseWriter, request *http.Request) {
	topology, err := s.store.Get(request.PathValue("id"))
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

func (s *Server) events(w http.ResponseWriter, request *http.Request) {
	if _, err := s.store.Get(request.PathValue("id")); err != nil {
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
	data, err := fs.ReadFile(s.static, requested)
	if err != nil {
		requested = "index.html"
		data, err = fs.ReadFile(s.static, requested)
	}
	if err != nil {
		writeError(w, http.StatusNotFound, "asset not found")
		return
	}
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
		ID:        id,
		Name:      strings.TrimSpace(name),
		Devices:   []model.Device{},
		Links:     []model.Link{},
		VLANs:     []model.VLAN{{ID: 1, Name: "Native", ColorHex: "#8a9ba8", Description: "Default untagged network"}},
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
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
