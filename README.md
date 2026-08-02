# Netdiagram

Netdiagram is a self-contained browser workstation for designing enterprise rack faceplates, physical port-to-port cabling, and VLAN forwarding maps. One static Go binary embeds the entire application and persists each topology as an atomically replaced JSON file.

## Demo

On first launch, Netdiagram creates a working topology with a carrier handoff, firewall, two 24-port switches, four VLANs, and patched uplinks. Drag hardware on the canvas, click one port and then another to install a cable, or select any endpoint to edit its switchport configuration.

## Getting started

Requirements: Go 1.26.5 or Docker.

```sh
go run ./cmd/server
```

Open `http://localhost:8080`. Runtime settings can be supplied as environment variables or flags:

| Environment | Flag | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | `-port` | `8080` | HTTP listen port |
| `DATA_DIR` | `-data-dir` | `data` | JSON topology directory |
| `LOG_LEVEL` | `-log-level` | `info` | `debug`, `info`, `warn`, or `error` |
| `LOG_FORMAT` | `-log-format` | `json` | `json` or `text` |

Build a static local binary:

```sh
make build
./netdiagram
```

## Docker

The final image is `FROM scratch`, runs as numeric user `10001`, and contains only the stripped static binary plus an empty `/data` mount point.

```sh
mkdir -p data
# On Linux, ensure UID 10001 can write the bind mount:
sudo chown 10001:10001 data
docker compose up --build
```

The container has a built-in health probe; no shell or HTTP client is added to the image.

## Features

- High-DPI Canvas 2D faceplates for switches, firewalls, routers, modems, patch panels, servers, and access points.
- Offline hardware catalog with model-aware faceplate schematics for Fortinet, Cisco, HPE Aruba, Juniper, Ubiquiti, MikroTik, Dell, NETGEAR, TP-Link Omada, Arista, Extreme, Ruckus, Palo Alto, Sophos, and Check Point, plus JSON profile import.
- Pan, 0.1×–5× zoom, grid-snapped device drag, selection box, exact port hit testing, animated LEDs, and port tooltips.
- Magnetic port-to-port cable drafting, speed-weighted Bezier paths, multi-color VLAN trunks, traffic pulses, labels, and warning overlays.
- Access, trunk, hybrid, and unconfigured port models with native and tagged VLAN membership.
- VLAN manager with safe deletion and automatic fallback of affected native ports to VLAN 1.
- Server-side native VLAN mismatch, tagged VLAN drop, switching-loop, and forwarding-path analysis.
- REST synchronization plus per-topology Server-Sent Events with heartbeats and bounded subscribers.
- PNG, standalone SVG, and JSON backup export; JSON restore; keyboard undo/redo and save.
- Strict JSON decoding, request-size limits, security headers, structured logs, graceful shutdown, and atomic file replacement.

## HTTP API

The API is rooted at `/api/v1`. Important resources include `/topologies`, `/topologies/{id}/devices`, `/ports`, `/links`, `/vlans`, `/analysis`, `/trace`, and `/events`. Errors use `{ "error": "message", "code": 400 }`. The interactive client is the reference for request bodies; the domain schema is defined in `internal/model`.

## Verification

```sh
make test
make race
make vet
go test -bench=. -benchmem ./...
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
