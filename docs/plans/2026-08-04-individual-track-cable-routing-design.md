# Individual-track cable routing

## Outcome

The live canvas and exported SVG use the same deterministic orthogonal track plan. Every persisted link receives an individual five-pixel lane, related device-pair links form compact trunk bundles, and vertical travel between rack units is confined to rack-side or inter-rack gutters.

## Batch planning model

Routing is planned for the complete visible link set instead of greedily solving one cable at a time. Links are canonicalized by their unordered source/destination device pair, sorted by physical port position and stable link ID, and assigned a bundle index from zero through `N - 1`. A five-pixel lane pitch is then applied to faceplate micro-lanes, rack gutters, and cross-rack channels.

Physical connector centers may already share a manufacturer-defined row coordinate. Lane uniqueness therefore begins immediately after each immutable connector endpoint; routed parallel segments never share a collinear span. Duplicate points and collinear interior points are removed, and every retained segment is asserted to be horizontal or vertical.

## Zero-extension faceplate exits

The first drawn segment leaves a port horizontally at its exact Y coordinate. It advances only far enough to reach a per-port escape column, turns vertically inside the device to a top- or bottom-row micro-lane, and then crosses the faceplate to the chosen rack edge. No vertical stub projects above or below the chassis.

Top-row links use lanes descending from the upper inner faceplate margin. Bottom-row links use lanes ascending from the lower margin. Each side and row has an independent deterministic lane allocator. If one device edge is saturated, new bundles use the other edge before lane pitch is reduced; the normal pitch remains five pixels.

## Rack and bridge tracks

Same-rack links select the shorter rack-side gutter and receive a unique vertical X coordinate outside the rack frame. Source and target micro-lanes remain within their respective device bounds, while the only inter-device vertical segment is in that gutter.

Cross-rack links use the gap between the two rack frames. Each device exits toward the facing rack edge, then a dedicated channel in the shared gap carries the vertical section. If two racks do not have a usable horizontal gap, the planner falls back to a unique outer perimeter gutter without crossing an intermediate device.

Free-canvas devices use the same device-edge and outer-gutter rules. Routes never rely on curves or diagonal fallback segments.

## Rendering and interaction

Routes are stored as orthogonal point arrays. Canvas rendering and SVG export preserve those Manhattan tracks, replacing only a short horizontal span at a perpendicular crossing with a compact jumper arc. The horizontal cable always owns the bow; the underlying vertical track stays continuous.

The cable casing receives a semantic role accent: cyan for high-speed cross-rack paths, amber for management, teal for grouped trunks, and blue for standard access. Existing native/tagged VLAN stripes remain the inner conductor so VLAN information is not lost.

Hover focus is resolved from link, port, or device identity. Related complete routes render at full opacity with a restrained glow; unrelated routes render at 20 percent opacity. The pointer tooltip identifies both rack, device, and port endpoints.

## Verification

Pure JavaScript tests cover deterministic bundle indices, five-pixel lane separation, immediate horizontal exits, top/bottom micro-lanes, axis-aligned segments, same-rack gutters, inter-rack channels, high-density assignment, hit testing, semantic role colors, and SVG `H`/`V` output. The complete unit, Go, race, vet, browser, Docker-health, and Graphify checks remain required.
