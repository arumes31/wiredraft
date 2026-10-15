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
	topology.Rooms = []Room{{ID: id, Name: "Serverraum", Building: "HQ", Floor: "EG", Color: "#42d9c8", Width: 1800, Height: 1200}}
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
