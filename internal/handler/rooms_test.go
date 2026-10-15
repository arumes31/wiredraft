package handler

import (
	"net/http"
	"reflect"
	"testing"

	"wiredraft/internal/model"
)

func TestRoomsPersistThroughTopologyAPI(t *testing.T) {
	t.Parallel()
	handler := newTestHandler(t)
	topology := requestTopology(t, handler, http.MethodPost, "/api/v1/topologies", map[string]string{"name": "Rooms", "template": "demo"}, http.StatusCreated)
	id, err := model.NewID()
	if err != nil {
		t.Fatal(err)
	}
	topology.Rooms = []model.Room{{ID: id, Name: "Server room", Color: "#42d9c8", Width: 1800, Height: 1200}}
	topology.Devices[0].RoomID = id
	path := "/api/v1/topologies/" + topology.ID
	requestTopology(t, handler, http.MethodPut, path, topology, http.StatusOK)
	saved := requestTopology(t, handler, http.MethodGet, path, nil, http.StatusOK)
	if !reflect.DeepEqual(saved.Rooms, topology.Rooms) || saved.Devices[0].RoomID != id {
		t.Fatal("room or membership lost")
	}
	if !reflect.DeepEqual(saved.Links, topology.Links) {
		t.Fatal("room membership changed cables")
	}
}
