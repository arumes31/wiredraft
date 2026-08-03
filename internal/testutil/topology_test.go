package testutil

import "testing"

func TestGenerateTopology(t *testing.T) {
	t.Parallel()
	topology, err := GenerateTopology(TopologyOptions{DeviceCount: 25, PortsPerDevice: 8, VLANCount: 4})
	if err != nil {
		t.Fatal(err)
	}
	if len(topology.Devices) != 25 || len(topology.Links) != 24 || len(topology.VLANs) != 4 {
		t.Fatalf("generated sizes = %d devices, %d links, %d VLANs", len(topology.Devices), len(topology.Links), len(topology.VLANs))
	}
	second, err := GenerateTopology(TopologyOptions{DeviceCount: 25, PortsPerDevice: 8, VLANCount: 4})
	if err != nil {
		t.Fatal(err)
	}
	if topology.ID != second.ID || topology.Links[10].ID != second.Links[10].ID {
		t.Fatal("generator is not deterministic")
	}
}

func TestGenerateTopologyRejectsUnsafeSizes(t *testing.T) {
	t.Parallel()
	for _, options := range []TopologyOptions{
		{},
		{DeviceCount: 1, PortsPerDevice: 1, VLANCount: 1},
		{DeviceCount: 1, PortsPerDevice: 2, VLANCount: 0},
	} {
		if _, err := GenerateTopology(options); err == nil {
			t.Fatalf("GenerateTopology(%+v) succeeded, want error", options)
		}
	}
}
