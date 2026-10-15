package model

import (
	"encoding/json"
	"math"
	"testing"
)

func TestRoomMembershipAndPersistence(t *testing.T) {
	topology, err := NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	id, err := NewID()
	if err != nil {
		t.Fatal(err)
	}
	topology.Rooms = []Room{{
		ID: id, Name: "Serverraum", Building: "HQ", Floor: "EG", Color: "#42d9c8",
		Width: 1800, Height: 1200, Padding: 360, EquipmentGap: 260,
	}}
	rackID, err := NewID()
	if err != nil {
		t.Fatal(err)
	}
	topology.Racks = []Rack{{ID: rackID, Name: "R01", HeightU: 6, Color: "#304348", RoomID: id}}
	if err := topology.Validate(); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(topology)
	if err != nil {
		t.Fatal(err)
	}
	var restored Topology
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatal(err)
	}
	if len(restored.Rooms) != 1 || restored.Racks[0].RoomID != id {
		t.Fatal("room membership lost")
	}
	if restored.Rooms[0].Padding != 360 || restored.Rooms[0].EquipmentGap != 260 {
		t.Fatal("room spacing lost")
	}
	for _, change := range []func(*Topology){
		func(top *Topology) { top.Rooms = append(top.Rooms, top.Rooms[0]) },
		func(top *Topology) { top.Racks[0].RoomID = "missing" },
		func(top *Topology) { top.Devices[0].RoomID = "missing" },
		func(top *Topology) { top.Rooms[0].Width = -1 },
		func(top *Topology) { top.Rooms[0].PositionX = math.Inf(1) },
		func(top *Topology) { top.Rooms[0].Name = " " },
		func(top *Topology) { top.Rooms[0].Color = "red" },
	} {
		cloned, err := topology.Clone()
		if err != nil {
			t.Fatal(err)
		}
		change(&cloned)
		if cloned.Validate() == nil {
			t.Fatal("invalid room accepted")
		}
	}
}

func TestRoomSpacing(t *testing.T) {
	t.Parallel()
	id, err := NewID()
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name    string
		padding float64
		gap     float64
		valid   bool
	}{
		{name: "legacy defaults", valid: true},
		{name: "custom spacing", padding: 360, gap: 260, valid: true},
		{name: "limits", padding: 10, gap: 2000, valid: true},
		{name: "negative gap", gap: -1},
		{name: "small padding", padding: 1},
		{name: "gap below rack clearance", gap: 89},
		{name: "large gap", gap: 2001},
		{name: "nonfinite padding", padding: math.NaN()},
		{name: "nonfinite gap", gap: math.Inf(1)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			room := Room{ID: id, Name: "Room", Color: "#42d9c8", Width: 1800, Height: 1200,
				Padding: tt.padding, EquipmentGap: tt.gap}
			if err := room.Validate(); (err == nil) != tt.valid {
				t.Fatalf("Validate() = %v, want valid=%v", err, tt.valid)
			}
		})
	}
}
