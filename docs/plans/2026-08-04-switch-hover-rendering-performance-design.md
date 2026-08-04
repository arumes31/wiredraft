# Switch-hover rendering performance

## Problem

Hovering a switch focuses every attached physical path. The renderer previously treated each attached path like a directly hovered cable: after the normal cable passes it redrew five additional glow, casing, role, and VLAN layers, enabled focused pulses, and kept Balanced mode running at 24 FPS while the pointer was stationary. Dense 48/96-port devices therefore multiplied both CPU path construction and GPU shadow work.

## Options considered

1. Debounce pointer events. This reduces frame count but makes the speech bubble and hover target feel delayed, while every emitted frame remains expensive.
2. Split the canvas into persistent rack/device/cable layers. This offers the largest future gain, but is a broad rendering-architecture change with more invalidation and export risk than this interaction needs.
3. Keep device hover as static isolation and reserve detailed glow for direct port/cable hover. This preserves topology comprehension: attached paths remain at full opacity and unrelated paths dim to 20%, without pretending dozens of paths are the single active cable.

Option 3 is selected. Device-hover repainting is capped at 30 FPS (or the lower active profile limit), and a stationary device hover does not start a focused animation loop in Balanced mode. Quality mode may continue its explicitly selected all-link animation, but is capped at 30 FPS during device hover. Direct port and cable hover retain the existing detailed whole-path glow.

## Scene indexing

Layout now builds maps for device boxes, port boxes, per-device ports, ordered links, VLANs, link groups, and port/device attachment sets. Hover rendering and tooltips reuse these maps instead of repeatedly filtering every port and link on each frame. Topology invalidation already rebuilds layout, so these indexes follow the existing cache lifetime and require no new persistence state.

## Verification

- Device hover still returns every attached link ID and dims unrelated links.
- Device hover produces no detailed multi-pass cable redraw and requests no continuous focused animation.
- Port and cable hover retain detailed highlighting.
- Quality device-hover input is capped at 30 FPS; Balanced remains capped at 24 FPS.
- Cached device attachment sets are returned by identity, proving the hot path does not rescan topology links.
