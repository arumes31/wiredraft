package model

import (
	"encoding/json"
	"testing"
)

func FuzzTopologyJSON(f *testing.F) {
	demo, err := NewDemo()
	if err != nil {
		f.Fatal(err)
	}
	seed, err := json.Marshal(demo)
	if err != nil {
		f.Fatal(err)
	}
	f.Add(seed)
	f.Add([]byte(`{"id":null}`))
	f.Add([]byte(`[]{} trailing`))
	f.Fuzz(func(t *testing.T, input []byte) {
		if len(input) > 1<<20 {
			t.Skip()
		}
		var topology Topology
		if err := json.Unmarshal(input, &topology); err == nil {
			if err := topology.Validate(); err != nil {
				t.Fatalf("accepted JSON produced an invalid topology: %v", err)
			}
			if _, err := json.Marshal(topology); err != nil {
				t.Fatalf("accepted topology could not be re-encoded: %v", err)
			}
		}
	})
}
