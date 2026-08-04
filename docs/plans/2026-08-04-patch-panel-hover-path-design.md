# Patch-panel hover path design

## Goal

Hovering a cable that terminates on a patch panel should reveal its complete physical path: the front cable, the rear structured-wiring mapping on the same jack, and the front cable leaving the mapped jack for the next device. Chained panels should continue in the same way.

## Termination graph

Each numbered patch-panel port has independent front and rear termination planes. The only implicit connection is between those two planes on the exact same port. The renderer therefore creates graph edges between front-side and rear-side links sharing that port; it never connects different ports or applies this behavior to active devices.

Connected components are calculated once during scene layout and stored as a link-to-component index. Every link in a component references the same `Set`, avoiding topology scans during pointer movement. A visited set makes malformed cycles and longer panel chains safe.

## Hover behavior

The normal focus seed remains the hovered cable, logical link group, or rear channel. Physical patch paths are then unioned into that seed. Existing dimming, group highlighting, rear-line styling, and tooltips remain unchanged; only the complete electrically continuous path receives focus.

## Verification

Unit coverage verifies front-to-rear-to-front traversal, shared cache identity, isolation of unrelated links, and integration with the canvas hover focus set.
