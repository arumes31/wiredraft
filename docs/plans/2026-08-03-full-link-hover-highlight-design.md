# Full-link hover highlighting

## Goal

Hovering any visible part of a cable must highlight that cable's complete route from source port to target port. The effect must preserve native/trunk VLAN colors, crossing bridges, endpoint continuity, warnings, group markers, selection behavior, and clean exports.

## Considered approaches

1. Thicken only the route during its normal draw pass. This is simple, but cables drawn later can cover the highlight and make it appear incomplete.
2. Dim every non-hovered cable. This creates strong focus but makes the entire topology pulse visually whenever the pointer moves.
3. Redraw the hovered route after the normal cable pass. This guarantees a continuous topmost highlight without mutating topology data or de-emphasizing unrelated links.

The third approach is selected.

## Rendering contract

- Pointer hit-testing continues to use the routed curve and current zoom-aware tolerance.
- Pointer-down hit testing follows the visible interaction layers: a free physical port retains patching priority, then a routed cable wins over the faceplate or rack underneath it. A cable that is visibly highlighted over a device therefore always opens the link selection instead of starting a device drag.
- Each routed link entry retains the VLAN palette and warning state needed for an exact redraw.
- Interactive frames redraw the hovered route with two restrained cyan halo layers, its dark cable underlay, its real VLAN color bands, and its pulse.
- Warning markers are redrawn after the cable so they remain readable; group guides and labels are then drawn above the highlight.
- Non-interactive PNG/SVG rendering disables the transient hover pass.
- Stale hover references safely draw nothing.

## Verification

A focused browser-module test verifies the three full-route highlight layers, VLAN and pulse redraw, retained warning marker, stale-hover behavior, and export suppression. Existing routing, VLAN-color, label-layout, and canvas-interaction tests remain unchanged.
