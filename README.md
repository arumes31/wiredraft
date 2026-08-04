# Netdiagram

Netdiagram is a self-contained browser workstation for designing enterprise rack faceplates, physical port-to-port cabling, and VLAN forwarding maps. One static Go binary embeds the entire application and persists each topology as an atomically replaced JSON file.

Its native dialogs, export popover, and status toasts share a responsive industrial control-panel design with sticky actions, accessible titles, visible focus states, and reduced-motion support.

Hovering any cable redraws its complete source-to-target route above neighboring links with a restrained animated halo while preserving its real native/trunk VLAN colors.

## Demo

On first launch, Netdiagram creates a working topology with a carrier handoff, firewall, two 24-port switches, four VLANs, and patched uplinks. Add movable racks, drag hardware into a free whole-U position or leave it free-floating, click one port and then another to install a cable, or select any endpoint to edit its switchport configuration.

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
- Image-informed vector faceplates with sourced vendor-family chassis details, model-specific connector placement, and continuous cable curves drawn directly into every connected port.
- Integrated multi-rack planning with movable 6U–48U frames, numbered rails, whole-U snapping, collision prevention, capacity reporting, and non-destructive rack removal.
- Generic 1U–4U server rear builder with dynamically composed mixed card bays, live elevation preview, every supported connector family, and independent multi-device cabling.
- Offline 522-profile hardware catalog spanning enterprise networking, security, compute, power, KVM/console, storage, wireless, and passive fiber/copper patching, with 24 connector types through 800G OSFP and JSON profile import.
- Pan, 0.1×–5× zoom, viewport-tiled rendering, minimap navigation, collapsible rack/device/VLAN tree, grid-snapped drag ghosts, rack collision zones, selection box, persistent arrows/boxes/text notes, exact port hit testing, steady operational LEDs, and port tooltips.
- Adaptive `Auto`, `Performance`, `Balanced`, and `Quality` graphics modes persist per browser; static Performance and unfocused Balanced views stop requesting frames, hidden canvases suspend, and cached geometry, bounded frame rates, scaled pixel density, and focused effects reduce GPU use on large maps.
- Magnetic port-to-port cable drafting, speed-weighted Bezier paths, native-VLAN cable colors, animated multi-VLAN rainbow trunks, traffic pulses, warning overlays, and pointer-following speech bubbles for non-blocking port and cable hover details.
- Newly patched cables atomically set both physical endpoint ports to `up`, so their faceplate link LEDs become active immediately after a successful connection.
- Unpatching a cable atomically returns both now-unlinked endpoint ports to `down`, while rejected deletes leave the existing operational state untouched.
- Persistent Trunk, LACP, MC-LAG, and Failover link groups: drag a cable onto another cable to create, extend, or merge a bundle. Failover groups identify one preferred primary cable and mark the remaining members as backups; unusual combinations remain saved and are flagged by the topology analyzer.
- Group-scoped end-to-end VLAN editing applies one native/tagged profile atomically to every cable and every physical endpoint port in the selected Trunk, LACP, MC-LAG, or Failover group.
- Persistent logical switch systems for generic stacks, Aruba VSF, Fortinet MC-LAG, Cisco StackWise/VSS, Juniper Virtual Chassis, HPE/H3C IRF, and custom fabrics. Members keep independent faceplates and cable endpoints while inventory totals count the system as one logical unit.
- Per-VLAN spanning-tree simulation elects a deterministic root, maps Root/Designated/Blocked roles back to every physical member port, traces convergence paths, treats Stack/VSF/MC-LAG peers as one bridge, and collapses Trunk/LACP/MC-LAG bundles plus inactive failover backups correctly.
- Device inventory records distinguish display name from hostname and include management IP, serial number, asset tag, owner/team, structured site/building/floor/room/rack/U placement, and configurable STP bridge priority.
- Persistent active/active and active/passive firewall clusters with explicit active-member selection, HA peer highlighting, physical member roles, safe failover reassignment after deletion, and one-unit logical inventory counting.
- Peer-aware bundle visualization: each link group uses one shared two-line plate with mode-specific endpoint/member details, while deterministic label placement keeps every cable nameplate separated and adds a leader when it must move away from its cable.
- Group-aware cable routing processes Trunk, LACP, MC-LAG, and Failover members together so they enter a compact parallel corridor as soon as their real port exits permit and stay bundled until target fan-out.
- Obstacle-aware cabling uses cached multi-segment routes around unrelated equipment and ports; physical interface names are rendered last as high-contrast faceplate badges so they remain legible at connected sockets.
- Shared cable corridors use deterministic closely spaced lanes instead of overlapping strokes or wide detours; unavoidable crossings use a compact jump-over bridge while the lower VLAN-colored cable remains visibly continuous through its opening in canvas and SVG exports.
- Source-backed printed interface legends for common FortiGate families (`WAN1`, `WAN2`, `A`, `B`, `DMZ`, `HA`, `MGMT`, `X1`…), sequential physical switch labels, and vendor-family naming for other firewall profiles.
- Access, trunk, hybrid, and unconfigured port models with native and tagged VLAN membership.
- Independent port transceiver/media and cable-media editing for CAT5e/CAT6/CAT6A, SMF/MMF, generic fiber, DAC, AOC, and twinax.
- VLAN manager with safe deletion and automatic fallback of affected native ports to VLAN 1.
- Server-side native VLAN mismatch, tagged VLAN drop, switching-loop, and forwarding-path analysis; servers remain non-forwarding endpoints when multi-homed.
- Default-on 30-second autosave with 1/5-minute options, manual save, dirty-title state, optimistic revision checks, and conflict-safe reload of newer shared revisions.
- Revisioned Server-Sent Events, anchored comment threads, embedded/external HTTP(S) documentation, and cryptographically tokenized revocable read-only shares.
- Direct A3 PDF, responsive standalone HTML with embedded SVG/source data and documentation links, PNG, standalone SVG, and JSON backup export; JSON restore; keyboard undo/redo and save. Heavy catalog, analysis, and export modules load on demand.
- Strict JSON decoding, request-size limits, security headers, structured logs, graceful shutdown, and atomic file replacement.

## HTTP API

The API is rooted at `/api/v1`. Important resources include `/topologies`, `/topologies/{id}/racks`, `/topologies/{id}/devices`, `/ports`, `/links`, `/link-groups`, `/switch-systems`, `/firewall-clusters`, `/vlans`, `/comments`, `/documentation-links`, `/shares`, `/analysis`, `/trace`, and `/events`; read-only tokens use `/api/v1/shared/{topologyId}/{token}`. Mutations accept `If-Match: "rev-N"`. Errors use `{ "error": "message", "code": 400 }`. The interactive client is the reference for request bodies; the domain schema is defined in `internal/model`.

## Verification

Run the complete local equivalent of the GitHub quality suite from PowerShell 7:

```powershell
pwsh -NoProfile -File scripts/ci-local.ps1
```

The command covers formatting and static analysis, race/fuzz/coverage tests, dependency and secret scans, Dockerfile/container scanning, SBOM generation, mutation testing, all supported browsers, accessibility, and visual regression. GitHub additionally runs CodeQL, dependency-diff review, OpenSSF Scorecard, and signed build/SBOM attestations because those gates require GitHub services and OIDC.

For quick development loops, use `-SkipBrowsers` or `-SkipContainers`; do not use those switches for the final pre-review run. Benchmarks remain available through `go test -bench=. -benchmem ./...`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
