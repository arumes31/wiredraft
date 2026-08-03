package model

import (
	"encoding/json"
	"testing"
)

func TestTopologyNormalizeInitializesRacks(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.Racks = nil
	topology.Normalize()
	if topology.Racks == nil {
		t.Fatal("Normalize() racks = nil, want initialized slice")
	}
}

func TestTopologyUnmarshalAcceptsTopologyWithoutRacks(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	data, err := json.Marshal(topology)
	if err != nil {
		t.Fatal(err)
	}
	var document map[string]any
	if err := json.Unmarshal(data, &document); err != nil {
		t.Fatal(err)
	}
	delete(document, "racks")
	legacy, err := json.Marshal(document)
	if err != nil {
		t.Fatal(err)
	}
	var decoded Topology
	if err := json.Unmarshal(legacy, &decoded); err != nil {
		t.Fatalf("UnmarshalJSON() legacy topology error = %v", err)
	}
	if decoded.Racks == nil || len(decoded.Racks) != 0 {
		t.Fatalf("decoded racks = %#v, want empty initialized slice", decoded.Racks)
	}
}

func TestTopologyValidateRackPlacements(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		configure func(*testing.T, *Topology, Rack)
		wantError bool
	}{
		{
			name: "separate whole-unit ranges",
			configure: func(_ *testing.T, topology *Topology, rack Rack) {
				topology.Devices[0].RackID = rack.ID
				topology.Devices[0].RackUnit = 1
				topology.Devices[1].RackID = rack.ID
				topology.Devices[1].RackUnit = 2
			},
		},
		{
			name: "overlapping ranges",
			configure: func(_ *testing.T, topology *Topology, rack Rack) {
				topology.Devices[0].RackID = rack.ID
				topology.Devices[0].RackUnit = 1
				topology.Devices[1].RackID = rack.ID
				topology.Devices[1].RackUnit = 1
			},
			wantError: true,
		},
		{
			name: "placement above rack capacity",
			configure: func(_ *testing.T, topology *Topology, rack Rack) {
				topology.Devices[0].RackID = rack.ID
				topology.Devices[0].RackUnit = rack.HeightU + 1
			},
			wantError: true,
		},
		{
			name: "unknown rack reference",
			configure: func(t *testing.T, topology *Topology, _ Rack) {
				topology.Devices[0].RackID = mustID(t)
				topology.Devices[0].RackUnit = 1
			},
			wantError: true,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			topology := mustDemo(t)
			rack := Rack{
				ID: mustID(t), Name: "RACK A01", PositionX: 80, PositionY: 80,
				HeightU: 12, Color: "#2c4b4e",
			}
			topology.Racks = append(topology.Racks, rack)
			test.configure(t, &topology, rack)
			err := topology.Validate()
			if test.wantError && err == nil {
				t.Fatal("Validate() error = nil, want rack placement error")
			}
			if !test.wantError && err != nil {
				t.Fatalf("Validate() error = %v", err)
			}
		})
	}
}

func TestRackValidate(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		configure func(*Rack)
		wantError bool
	}{
		{name: "minimum capacity", configure: func(rack *Rack) { rack.HeightU = 6 }},
		{name: "maximum capacity", configure: func(rack *Rack) { rack.HeightU = 48 }},
		{name: "below minimum", configure: func(rack *Rack) { rack.HeightU = 5 }, wantError: true},
		{name: "above maximum", configure: func(rack *Rack) { rack.HeightU = 49 }, wantError: true},
		{name: "invalid color", configure: func(rack *Rack) { rack.Color = "graphite" }, wantError: true},
		{name: "missing name", configure: func(rack *Rack) { rack.Name = "" }, wantError: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			rack := Rack{ID: mustID(t), Name: "RACK A01", HeightU: 42, Color: "#2c4b4e"}
			test.configure(&rack)
			err := rack.Validate()
			if test.wantError && err == nil {
				t.Fatal("Validate() error = nil, want validation error")
			}
			if !test.wantError && err != nil {
				t.Fatalf("Validate() error = %v", err)
			}
		})
	}
}
