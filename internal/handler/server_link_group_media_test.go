package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	"wiredraft/internal/model"
)

// TestLinkGroupMediaCreateAndUpdate exercises both atomic mutation paths with complete source and target records.
func TestLinkGroupMediaCreateAndUpdate(t *testing.T) {
	t.Parallel()
	for _, operation := range []string{"create", "update"} {
		for _, tc := range []struct {
			name                 string
			physical             bool
			mixedSide, badMember string
			wantError            bool
		}{
			{name: "ethernet"},
			{name: "all physical", physical: true},
			{name: "mixed member links", mixedSide: "both", wantError: true},
			{name: "mixed source endpoint", mixedSide: "source", wantError: true},
			{name: "mixed target endpoint", mixedSide: "target", wantError: true},
			{name: "missing member", badMember: "absent", wantError: true},
			{name: "duplicate member", badMember: "duplicate", wantError: true},
			{name: "empty member", badMember: "empty", wantError: true},
		} {
			t.Run(operation+"/"+tc.name, func(t *testing.T) {
				t.Parallel()
				handler := newTestHandler(t)
				topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"name": "Group media", "template": "demo"}, http.StatusCreated)
				physicalTypes := []model.PortType{model.PortTypePower, model.PortTypeSASMiniHD12G, model.PortTypeSASMini6G, model.PortTypeFCSFP16G}
				for index, link := range topology.Links[:3] {
					for side, id := range []string{link.SourcePortID, link.TargetPortID} {
						physical := tc.physical || (index == 2 && (tc.mixedSide == "both" || (side == 0 && tc.mixedSide == "source") || (side == 1 && tc.mixedSide == "target")))
						if !physical {
							continue
						}
						for di := range topology.Devices {
							for pi := range topology.Devices[di].Ports {
								port := &topology.Devices[di].Ports[pi]
								if port.ID == id {
									port.Type = physicalTypes[(index*2+side)%len(physicalTypes)]
								}
							}
						}
					}
				}
				topology = requestTopology(t, handler, http.MethodPut, "/api/v1/topologies/"+topology.ID, topology, http.StatusOK)
				path, method := "/api/v1/topologies/"+topology.ID+"/link-groups", http.MethodPost
				group := model.LinkGroup{Name: "Cable bundle", Mode: model.LinkGroupModeLACP, LinkIDs: []string{topology.Links[0].ID, topology.Links[1].ID}}
				if operation == "update" {
					topology = requestTopology(t, handler, http.MethodPost, path, group, http.StatusCreated)
					group = topology.LinkGroups[0]
					path, method = path+"/"+group.ID, http.MethodPut
				}
				group.LinkIDs = []string{topology.Links[0].ID, topology.Links[2].ID}
				switch tc.badMember {
				case "absent":
					group.LinkIDs[1] = "absent"
				case "duplicate":
					group.LinkIDs[1] = group.LinkIDs[0]
				case "empty":
					group.LinkIDs = nil
				}
				body, err := json.Marshal(group)
				if err != nil {
					t.Fatal(err)
				}
				request := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(string(body)))
				request.Header.Set("If-Match", topologyRevisionETag(topology.Revision))
				response := httptest.NewRecorder()
				handler.ServeHTTP(response, request)
				wantStatus := http.StatusCreated
				if operation == "update" {
					wantStatus = http.StatusOK
				}
				if tc.wantError {
					wantStatus = http.StatusBadRequest
				}
				if response.Code != wantStatus {
					t.Fatalf("status=%d want%d body=%s", response.Code, wantStatus, response.Body.String())
				}
				after := requestTopology(t, handler, http.MethodGet, "/api/v1/topologies/"+topology.ID, nil, http.StatusOK)
				if tc.wantError {
					if !reflect.DeepEqual(after, topology) {
						t.Fatal("rejected group mutation changed stored topology")
					}
				} else {
					expectedMembers := slices.Clone(group.LinkIDs)
					slices.Sort(expectedMembers)
					if len(after.LinkGroups) != 1 || !slices.Equal(after.LinkGroups[0].LinkIDs, expectedMembers) {
						t.Fatalf("valid homogeneous group was not persisted: groups=%#v want members=%v", after.LinkGroups, group.LinkIDs)
					}
					if !reflect.DeepEqual(after.Devices, topology.Devices) || !reflect.DeepEqual(after.Links, topology.Links) {
						t.Fatal("group mutation rewrote member links or endpoint records")
					}
				}
			})
		}
	}
}
