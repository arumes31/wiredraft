package model_test

import (
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
