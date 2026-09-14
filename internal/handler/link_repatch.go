package handler

import (
	"fmt"
	"net/http"

	"wiredraft/internal/model"
	"wiredraft/internal/store"
)

type linkRepatchRequest struct {
	Endpoint   string `json:"endpoint"`
	PortID     string `json:"portId"`
	SwapLinkID string `json:"swapLinkId,omitempty"`
}

// repatchLink moves one cable end, or exchanges two explicitly confirmed ends,
// in a single revision. Switchport configuration belongs to the physical port.
func (s *Server) repatchLink(w http.ResponseWriter, request *http.Request) {
	var input linkRepatchRequest
	if err := decodeJSON(w, request, &input); err != nil ||
		(input.Endpoint != "source" && input.Endpoint != "target") || input.PortID == "" {
		writeError(w, http.StatusBadRequest, "invalid cable endpoint")
		return
	}
	revision, err := parseExpectedRevision(request.Header.Get("If-Match"))
	if err != nil || revision == 0 {
		writeError(w, http.StatusBadRequest, "cable repatching requires the displayed topology revision")
		return
	}
	id, linkID := request.PathValue("id"), request.PathValue("linkId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		return applyLinkRepatch(topology, linkID, input)
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "link_repatched", updated)
	writeJSON(w, http.StatusOK, updated)
}

func applyLinkRepatch(topology *model.Topology, linkID string, input linkRepatchRequest) error {
	index := slicesIndex(topology.Links, func(link model.Link) bool { return link.ID == linkID })
	if index < 0 {
		return store.ErrNotFound
	}
	link := &topology.Links[index]
	if input.PortID == link.SourcePortID || input.PortID == link.TargetPortID {
		return fmt.Errorf("%w: choose a different cable endpoint", store.ErrInvalid)
	}
	var destination *model.Port
	for di := range topology.Devices {
		for pi := range topology.Devices[di].Ports {
			port := &topology.Devices[di].Ports[pi]
			if port.ID == input.PortID {
				destination = port
			}
		}
	}
	if destination == nil {
		return fmt.Errorf("%w: destination port does not exist", store.ErrInvalid)
	}
	oldDeviceID, oldPortID, side := cableEndpoint(*link, input.Endpoint)
	swapIndex, swapEndpoint := -1, ""
	for i, candidate := range topology.Links {
		for _, endpoint := range []string{"source", "target"} {
			_, portID, candidateSide := cableEndpoint(candidate, endpoint)
			if portID == input.PortID && candidateSide == side {
				swapIndex, swapEndpoint = i, endpoint
			}
		}
	}
	if swapIndex >= 0 {
		if input.SwapLinkID != topology.Links[swapIndex].ID {
			return fmt.Errorf("%w: confirm the cable currently occupying the destination", store.ErrInvalid)
		}
		setCableEndpoint(&topology.Links[swapIndex], swapEndpoint, oldDeviceID, oldPortID)
	} else if input.SwapLinkID != "" {
		return fmt.Errorf("%w: the confirmed cable no longer occupies the destination", store.ErrInvalid)
	}
	previous := *link
	setCableEndpoint(link, input.Endpoint, destination.DeviceID, destination.ID)
	if swapIndex < 0 && side == model.LinkEndpointSideFront {
		destination.Status = model.PortStatusUp
		deactivateUnlinkedEndpointPorts(topology, previous)
	}
	// The store validates the entire resulting topology before committing either end.
	return nil
}

func cableEndpoint(link model.Link, endpoint string) (string, string, model.LinkEndpointSide) {
	if endpoint == "source" {
		return link.SourceDeviceID, link.SourcePortID, link.EffectiveSourceSide()
	}
	return link.TargetDeviceID, link.TargetPortID, link.EffectiveTargetSide()
}

func setCableEndpoint(link *model.Link, endpoint, deviceID, portID string) {
	if endpoint == "source" {
		link.SourceDeviceID, link.SourcePortID = deviceID, portID
	} else {
		link.TargetDeviceID, link.TargetPortID = deviceID, portID
	}
}
