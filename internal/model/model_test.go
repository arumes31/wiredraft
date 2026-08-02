package model

import (
	"slices"
	"testing"
)

func TestNewDemo(t *testing.T) {
	t.Parallel()
	topology, err := NewDemo()
	if err != nil {
		t.Fatalf("NewDemo() error = %v", err)
	}
	if err := topology.Validate(); err != nil {
		t.Fatalf("demo Validate() error = %v", err)
	}
	if len(topology.Devices) != 4 {
		t.Fatalf("len(Devices) = %d, want 4", len(topology.Devices))
	}
	if len(topology.VLANs) != 4 {
		t.Fatalf("len(VLANs) = %d, want 4", len(topology.VLANs))
	}
}

func TestTopologyValidateOccupiedPort(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	duplicate := topology.Links[0]
	duplicate.ID = mustID(t)
	topology.Links = append(topology.Links, duplicate)
	if err := topology.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want occupied port error")
	}
}

func TestAnalyze(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.Devices[1].Ports[0].NativeVLAN = 20
	analysis := Analyze(topology)
	if !slices.ContainsFunc(analysis.Issues, func(issue Issue) bool {
		return issue.Kind == "native_vlan_mismatch" && issue.LinkID == topology.Links[0].ID
	}) {
		t.Fatalf("Analyze() issues = %#v, want native VLAN mismatch", analysis.Issues)
	}
}

func TestAnalyzeLoop(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	topology.Links = append(topology.Links, Link{
		ID:             mustID(t),
		SourceDeviceID: topology.Devices[1].ID,
		SourcePortID:   topology.Devices[1].Ports[2].ID,
		TargetDeviceID: topology.Devices[3].ID,
		TargetPortID:   topology.Devices[3].Ports[1].ID,
		CableType:      "CAT6A",
		VLANIDs:        []int{1},
		PrimaryVLAN:    1,
	})
	if err := topology.Validate(); err != nil {
		t.Fatalf("loop fixture Validate() error = %v", err)
	}
	analysis := Analyze(topology)
	if !slices.ContainsFunc(analysis.Loops, func(loop Loop) bool { return loop.VLANID == 1 }) {
		t.Fatalf("Analyze() loops = %#v, want VLAN 1 loop", analysis.Loops)
	}
}

func TestTracePath(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	links, err := TracePath(topology, topology.Devices[0].Ports[0].ID, topology.Devices[3].Ports[0].ID, 1)
	if err != nil {
		t.Fatalf("TracePath() error = %v", err)
	}
	if len(links) != 3 {
		t.Fatalf("TracePath() links = %d, want 3", len(links))
	}
}

func TestTracePathMissingVLAN(t *testing.T) {
	t.Parallel()
	topology := mustDemo(t)
	if _, err := TracePath(topology, topology.Devices[0].Ports[0].ID, topology.Devices[3].Ports[0].ID, 30); err == nil {
		t.Fatal("TracePath() error = nil, want missing VLAN error")
	}
}

func BenchmarkTopologyClone(b *testing.B) {
	topology, err := NewDemo()
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	for b.Loop() {
		if _, err := topology.Clone(); err != nil {
			b.Fatal(err)
		}
	}
}

func mustDemo(t *testing.T) Topology {
	t.Helper()
	topology, err := NewDemo()
	if err != nil {
		t.Fatal(err)
	}
	return topology
}

func mustID(t *testing.T) string {
	t.Helper()
	id, err := NewID()
	if err != nil {
		t.Fatal(err)
	}
	return id
}
