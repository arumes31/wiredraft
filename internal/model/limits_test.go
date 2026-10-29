package model_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"wiredraft/internal/model"
	"wiredraft/internal/testutil"
)

func TestTopologyCardinalityLimits(t *testing.T) {
	t.Parallel()
	topology, err := testutil.GenerateTopology(testutil.TopologyOptions{DeviceCount: 3, PortsPerDevice: 4, VLANCount: 1})
	if err != nil {
		t.Fatal(err)
	}

	oversizedDevice := topology
	oversizedDevice.Devices = append([]model.Device(nil), topology.Devices...)
	oversizedDevice.Devices[0].Ports = make([]model.Port, model.MaxDevicePorts+1)
	if err := oversizedDevice.Validate(); err == nil || !strings.Contains(err.Error(), "ports") {
		t.Fatalf("device with %d ports validated: %v", model.MaxDevicePorts+1, err)
	}

	tooManyLinks := topology
	tooManyLinks.Links = make([]model.Link, model.MaxTopologyLinks+1)
	if err := tooManyLinks.Validate(); err == nil || !strings.Contains(err.Error(), "links") {
		t.Fatalf("topology with %d links validated: %v", model.MaxTopologyLinks+1, err)
	}

	tooManyDevices := topology
	tooManyDevices.Devices = make([]model.Device, model.MaxTopologyDevices+1)
	if err := tooManyDevices.Validate(); err == nil || !strings.Contains(err.Error(), "devices") {
		t.Fatalf("topology with %d devices validated: %v", model.MaxTopologyDevices+1, err)
	}
}

func TestValidateDocumentSize(t *testing.T) {
	t.Parallel()
	if err := model.ValidateDocumentSize(make([]byte, model.MaxTopologyDocumentBytes)); err != nil {
		t.Fatalf("document at the limit rejected: %v", err)
	}
	if err := model.ValidateDocumentSize(make([]byte, model.MaxTopologyDocumentBytes+1)); err == nil {
		t.Fatal("document above the limit accepted")
	}
}

func TestSTPPathOutputIsBoundedOnLongChains(t *testing.T) {
	t.Parallel()
	// A chain of N bridges materializes about N^2 path entries without a budget.
	topology, err := testutil.GenerateTopology(testutil.TopologyOptions{DeviceCount: 1000, PortsPerDevice: 2, VLANCount: 1})
	if err != nil {
		t.Fatal(err)
	}
	analysis := model.Analyze(topology)
	entries := 0
	truncated := false
	for _, instance := range analysis.STP {
		truncated = truncated || instance.PathsTruncated
		for _, path := range instance.Paths {
			entries += len(path.BridgeIDs) + len(path.LinkIDs)
		}
	}
	if !truncated {
		t.Fatal("long chain analysis did not report truncated STP paths")
	}
	if entries > 200000 {
		t.Fatalf("materialized %d STP path entries, want at most 200000", entries)
	}

	small, err := testutil.GenerateTopology(testutil.TopologyOptions{DeviceCount: 25, PortsPerDevice: 4, VLANCount: 2})
	if err != nil {
		t.Fatal(err)
	}
	for _, instance := range model.Analyze(small).STP {
		if instance.PathsTruncated || len(instance.Paths) != len(instance.Bridges) {
			t.Fatalf("small topology paths truncated=%t paths=%d bridges=%d", instance.PathsTruncated, len(instance.Paths), len(instance.Bridges))
		}
	}
}

func TestSTPBridgeMembershipOutputIsBounded(t *testing.T) {
	t.Parallel()
	// Every bridge reports its chassis once per VLAN, so 800 bridges across 256
	// VLANs would materialize 204800 member entries without a budget.
	topology, err := testutil.GenerateTopology(testutil.TopologyOptions{DeviceCount: 800, PortsPerDevice: 2, VLANCount: 256})
	if err != nil {
		t.Fatal(err)
	}
	entries := 0
	truncated := false
	for _, instance := range model.Analyze(topology).STP {
		truncated = truncated || instance.BridgeMembersTruncated
		for _, bridge := range instance.Bridges {
			entries += len(bridge.DeviceIDs)
		}
	}
	if !truncated {
		t.Fatal("analysis did not report truncated bridge membership")
	}
	if entries > 200000 {
		t.Fatalf("materialized %d bridge member entries, want at most 200000", entries)
	}
}

func TestAnalyzeContextStopsWhenCancelled(t *testing.T) {
	t.Parallel()
	topology, err := testutil.GenerateTopology(testutil.TopologyOptions{DeviceCount: 10, PortsPerDevice: 2, VLANCount: 4})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := model.AnalyzeContext(ctx, topology); !errors.Is(err, context.Canceled) {
		t.Fatalf("AnalyzeContext() error = %v, want context.Canceled", err)
	}
}

func TestCanvasPositionsAreBounded(t *testing.T) {
	t.Parallel()
	topology, err := testutil.GenerateTopology(testutil.TopologyOptions{DeviceCount: 2, PortsPerDevice: 2, VLANCount: 1})
	if err != nil {
		t.Fatal(err)
	}
	farDevice := topology
	farDevice.Devices = append([]model.Device(nil), topology.Devices...)
	farDevice.Devices[0].PositionX = 1e300
	if err := farDevice.Validate(); err == nil || !strings.Contains(err.Error(), "position") {
		t.Fatalf("device far outside the canvas validated: %v", err)
	}
	farRack := topology
	farRack.Racks = []model.Rack{{ID: "6f4cf2f4-3fb1-4c5e-9a0b-6d7c8e9f0a1b", Name: "R1", HeightU: 42, Color: "#334455", PositionY: -1e9}}
	if err := farRack.Validate(); err == nil || !strings.Contains(err.Error(), "position") {
		t.Fatalf("rack far outside the canvas validated: %v", err)
	}

	// Documents saved before the bound existed are repaired on load.
	encoded, err := json.Marshal(topology)
	if err != nil {
		t.Fatal(err)
	}
	var raw map[string]any
	if err := json.Unmarshal(encoded, &raw); err != nil {
		t.Fatal(err)
	}
	raw["devices"].([]any)[0].(map[string]any)["positionX"] = 1e300
	legacy, err := json.Marshal(raw)
	if err != nil {
		t.Fatal(err)
	}
	var loaded model.Topology
	if err := json.Unmarshal(legacy, &loaded); err != nil {
		t.Fatalf("legacy far-away device failed to load: %v", err)
	}
	if got := loaded.Devices[0].PositionX; got != model.MaxCanvasCoordinate {
		t.Fatalf("loaded device position = %v, want clamped to %v", got, model.MaxCanvasCoordinate)
	}
}
