package model_test

import (
	"encoding/json"
	"testing"

	"wiredraft/internal/model"
	"wiredraft/internal/testutil"
)

func BenchmarkTopologyJSON(b *testing.B) {
	topology := generatedBenchmarkTopology(b, 500, 24, 16)
	data, err := json.Marshal(topology)
	if err != nil {
		b.Fatal(err)
	}
	b.Run("marshal", func(b *testing.B) {
		b.ReportAllocs()
		b.SetBytes(int64(len(data)))
		for b.Loop() {
			if _, err := json.Marshal(topology); err != nil {
				b.Fatal(err)
			}
		}
	})
	b.Run("unmarshal", func(b *testing.B) {
		b.ReportAllocs()
		b.SetBytes(int64(len(data)))
		for b.Loop() {
			var decoded model.Topology
			if err := json.Unmarshal(data, &decoded); err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkAnalyzeLargeTopology(b *testing.B) {
	for _, size := range []int{100, 1000, 5000} {
		topology := generatedBenchmarkTopology(b, size, 4, 8)
		b.Run(stringSize(size), func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				_ = model.Analyze(topology)
			}
		})
	}
}

func BenchmarkTraceLargeTopology(b *testing.B) {
	topology := generatedBenchmarkTopology(b, 1000, 4, 8)
	for b.Loop() {
		_, _ = model.TracePath(topology, topology.Devices[0].ID, topology.Devices[len(topology.Devices)-1].ID, 1)
	}
}

func generatedBenchmarkTopology(b *testing.B, devices, ports, vlans int) model.Topology {
	b.Helper()
	topology, err := testutil.GenerateTopology(testutil.TopologyOptions{
		DeviceCount: devices, PortsPerDevice: ports, VLANCount: vlans,
	})
	if err != nil {
		b.Fatal(err)
	}
	return topology
}

func stringSize(size int) string {
	switch size {
	case 100:
		return "devices_100"
	case 1000:
		return "devices_1000"
	default:
		return "devices_5000"
	}
}
