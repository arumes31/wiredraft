package model

import (
	"encoding/json"
	"strings"
	"testing"
)

// groupMediaSnapshot bypasses the aggregate's validating marshaler solely to compare rejected input without mutation.
type groupMediaSnapshot Topology

// TestTopologyValidateLinkGroupMedia checks every endpoint without changing valid physical or Ethernet groups.
func TestTopologyValidateLinkGroupMedia(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name      string
		types     [4]PortType
		wantError bool
	}{
		{name: "ethernet", types: [4]PortType{PortTypeRJ451G, PortTypeRJ451G, PortTypeSFP1G, PortTypeSFP1G}},
		{name: "all physical kinds", types: [4]PortType{PortTypePower, PortTypeSASMiniHD12G, PortTypeSASMini6G, PortTypeFCSFP16G}},
		{name: "physical then ethernet", types: [4]PortType{PortTypeSASMiniHD12G, PortTypeSASMiniHD12G, PortTypeRJ451G, PortTypeRJ451G}, wantError: true},
		{name: "ethernet then physical", types: [4]PortType{PortTypeRJ451G, PortTypeRJ451G, PortTypePower, PortTypePower}, wantError: true},
		{name: "first target mixed", types: [4]PortType{PortTypePower, PortTypeRJ451G, PortTypePower, PortTypePower}, wantError: true},
		{name: "last target mixed", types: [4]PortType{PortTypeFCSFP16G, PortTypeFCSFP16G, PortTypeFCSFP16G, PortTypeRJ451G}, wantError: true},
		{name: "only source physical", types: [4]PortType{PortTypeRJ451G, PortTypeRJ451G, PortTypeSASMini6G, PortTypeRJ451G}, wantError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			topology := mustDemo(t)
			for index, link := range topology.Links[:2] {
				for side, id := range []string{link.SourcePortID, link.TargetPortID} {
					for di := range topology.Devices {
						for pi := range topology.Devices[di].Ports {
							port := &topology.Devices[di].Ports[pi]
							if port.ID == id {
								port.Type = tc.types[index*2+side]
							}
						}
					}
				}
			}
			topology.LinkGroups = []LinkGroup{{ID: mustID(t), Name: "Media group", Mode: LinkGroupModeLACP, LinkIDs: []string{topology.Links[0].ID, topology.Links[1].ID}}}
			before, err := json.Marshal(groupMediaSnapshot(topology))
			if err != nil {
				t.Fatal(err)
			}
			err = topology.Validate()
			if tc.wantError {
				if err == nil || !strings.Contains(err.Error(), "physical") {
					t.Fatalf("Validate()=%v, want mixed physical/Ethernet error", err)
				}
			} else if err != nil {
				t.Fatalf("valid homogeneous group rejected: %v", err)
			}
			after, err := json.Marshal(groupMediaSnapshot(topology))
			if err != nil {
				t.Fatal(err)
			}
			if string(before) != string(after) {
				t.Fatal("validation rewrote topology")
			}
		})
	}
}

// TestLinkGroupValidateMissingMediaMembers keeps structural and incomplete-reference failures explicit.
func TestLinkGroupValidateMissingMediaMembers(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ name, member, source, target string }{
		{name: "missing link", member: "absent", source: "source", target: "target"},
		{name: "missing source", member: "second", source: "absent", target: "target"},
		{name: "missing target", member: "second", source: "source", target: "absent"},
		{name: "malformed empty target", member: "second", source: "source"},
		{name: "duplicate member", member: "first", source: "source", target: "target"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			group := LinkGroup{ID: mustID(t), Name: "Incomplete group", Mode: LinkGroupModeLACP, LinkIDs: []string{"first", tc.member}}
			links := map[string]Link{"first": {SourcePortID: "source", TargetPortID: "target"}, "second": {SourcePortID: tc.source, TargetPortID: tc.target}}
			ports := map[string]Port{"source": {Type: PortTypePower}, "target": {Type: PortTypePower}}
			if err := group.Validate(links, ports); err == nil {
				t.Fatal("incomplete or duplicate member was accepted")
			}
		})
	}
}
