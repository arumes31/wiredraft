// Command topologygen writes deterministic, validated stress-test topology JSON.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"wiredraft/internal/testutil"
)

func main() {
	devices := flag.Int("devices", 100, "number of switch devices")
	ports := flag.Int("ports", 8, "ports per device (2-96)")
	vlans := flag.Int("vlans", 8, "number of VLANs (1-256)")
	pretty := flag.Bool("pretty", true, "indent JSON output")
	flag.Parse()
	topology, err := testutil.GenerateTopology(testutil.TopologyOptions{
		DeviceCount: *devices, PortsPerDevice: *ports, VLANCount: *vlans,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	encoder := json.NewEncoder(os.Stdout)
	if *pretty {
		encoder.SetIndent("", "  ")
	}
	if err := encoder.Encode(topology); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
