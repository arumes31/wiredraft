# Changelog

## Unreleased

- Make canvas arrows, rectangles, and text notes selectable on their visible geometry, editable in the inspector, removable with the Delete key or inspector action, and allow drawing tools to be exited with Escape or a second click.
- Add a collapsible rack/device/VLAN navigator, interactive minimap, viewport-tiled infinite canvas, drag ghosts, rack collision zones, persistent arrows/boxes/text notes, skeleton loading, topology-size warnings, and queued notifications.
- Add default-on configurable autosave, unsaved document-title state, revision-aware writes, live collaboration snapshots, anchored comment threads, embedded documentation links, and revocable read-only share tokens.
- Expand the offline hardware catalog to 522 profiles across enterprise networking, security, compute, power, console, storage, wireless, and passive patching families, with 24 connector types through 800G OSFP.
- Allow physical media to be configured independently on ports and cables; link-group end-to-end configuration applies cable media and VLAN state across every member.
- Lazy-load catalog, analysis, and export modules; add topology tiling and size guards to keep large diagrams responsive.
- Add the quality program for validation edges, routing fixtures, API contracts, fuzzing, benchmarks, migrations, deterministic generators, SSE load/chaos, Chromium/Firefox/WebKit/Edge workflows, accessibility, coverage ratchets, mutation smoke checks, and container scanning.
- Render `up` port link LEDs as steady green instead of blinking green/amber, and stop active ports from keeping the canvas animation loop alive.
- Make hovered cables clickable across device faceplates by selecting routed links before the underlying device while preserving free-port patching priority.
- Open the Export popover below its toolbar trigger and close it automatically after a successful export or restore selection.
- Keep cable endpoint leads perpendicular to the faceplate, selecting a clear top or bottom exit without the former sideways bow across the device surface.
- Automatically set both physical endpoint ports to `down` when their cable is unplugged, in the same atomic mutation that removes the link and updates its link group.
- Route Trunk, LACP, MC-LAG, and Failover members together, joining a preferred parallel corridor immediately after their faceplate exits and preserving that bundle until target fan-out.
- Make cable crossings read as true jump-over bridges by preserving and redrawing the lower cable through a clipped bridge opening in both canvas and vector exports.
- Add persistent Auto/Performance/Balanced/Quality graphics modes with event-driven idle rendering, hidden-canvas suspension, topology and cable-bridge caches, bounded animation rates, adaptive pixel density, and load-scaled visual effects.
- Add dependency-free direct PDF export and a responsive standalone HTML report containing the topology SVG and embedded source data.
- Automatically mark both physical endpoint ports `up` when a new cable is successfully patched, without changing either port when link validation fails.
- Highlight the complete port-to-port route of a hovered cable above neighboring links while preserving VLAN bands, crossing bridges, warnings, and clean exports.
- Unify all dialogs, forms, the export popup, and status toast in a modern responsive control-panel design with sticky actions, accessible labels, improved focus states, and reduced-motion support.
- Route cables that share a corridor in compact parallel lanes and render unavoidable crossings with small deterministic jump-over bridges, including hit-testing, animation, PNG, and SVG output.
- Apply end-to-end VLAN changes to every cable and every unique endpoint port in the selected link group, with all member pairs and group-wide synchronization state visible in the inspector.
- Replace the uniform static-server NIC wizard with a generic 1U–4U rear-elevation builder supporting mixed BMC, copper, SFP/QSFP, console, WAN, and power cards across dynamically managed slots.
- Render single-VLAN links in their native VLAN color and trunks as animated bands containing every carried VLAN color, including SVG/PNG exports.
- Expand the built-in catalog from 67 to 280 profiles with 169 FortiGate and 53 FortiSwitch physical SKUs.
- Add searchable hardware SKUs, lifecycle/fidelity indicators, modular chassis notes, and multi-gig through 400G connector types.
- Add configurable static rack servers with up to 16 independent data NICs, optional BMC management, and connections to multiple network devices.
- Add integrated multi-rack placement with movable racks, whole-U equipment snapping, collision validation, capacity inspection, and safe rack removal that releases mounted devices.
- Render cable bodies behind equipment and redraw their exact endpoint curves above faceplates so the real cable reaches each port continuously; add sourced vector chassis templates covering every built-in hardware profile.
- Treat server interfaces as non-forwarding endpoints during loop detection and VLAN path tracing.
- Add persistent Trunk, LACP, and MC-LAG cable groups created by dragging one cable onto another, with extend/merge behavior, inspector controls, and advisory topology warnings instead of hard rejection.
- Replace generated FortiGate interface legends with source-backed physical names for common families (including WAN, A/B, DMZ, HA, MGMT, numbered, SFP, and X interfaces), correct the FortiGate 80F shared WAN/SFP population, and apply vendor naming conventions throughout the catalog.
- Add Failover link groups with an explicit preferred primary cable, clearly marked backup members, safe primary reassignment when a cable is removed, and advisory VLAN-equivalence warnings.
- Add persistent multi-member logical switch systems for stacks, Aruba VSF, Fortinet MC-LAG, Cisco StackWise/VSS, Juniper Virtual Chassis, IRF, and custom fabrics, with peer highlighting, automatic pruning, and logical-unit inventory counts.
- Add persistent active/active and active/passive firewall clusters with preferred-active roles, multi-member inspector controls, faceplate HA badges, peer highlighting, automatic role reassignment, and logical-unit counts.
- Replace repeated bundle labels with shared peer-aware Trunk/LACP/MC-LAG/Failover plates, membership guides, and deterministic collision-free cable-nameplate placement.
- Move transient port and cable hover details into pointer-following canvas speech bubbles that remain readable at every zoom level, flip at viewport edges, and never intercept clicks.
- Route cables around unrelated chassis and port banks with cached multi-segment paths, and redraw physical interface names as high-contrast silkscreen badges above cable terminations.

All notable user-visible changes are documented here.

## [1.0.0] - 2026-08-02

### Added

- Interactive rack device, port, cable, VLAN, validation, and path-tracing workspace.
- Atomic JSON persistence and first-run demo topology.
- Versioned REST API and native Server-Sent Events synchronization.
- PNG, SVG, and JSON backup export plus JSON restore.
- Dependency-free static binary and scratch container packaging.
