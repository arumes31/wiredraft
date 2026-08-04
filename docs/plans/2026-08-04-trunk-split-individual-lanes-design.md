# Trunk and split-link individual-lane design

## Goal

Render every physical member of a Trunk, LACP, MC-LAG, or Failover group as an independent orthogonal cable. Group membership may influence lane placement, but it must never add synthetic cable geometry or junction nodes.

## Chosen approach

The shared cable planner receives the topology link groups and treats each explicit group as a routing bundle. Members are sorted deterministically, planned consecutively, and use a 5px bundle pitch for their faceplate micro-lanes, vertical gutters, and perimeter bridges. Group-member strokes are compacted so their outlines do not merge at that pitch. Ungrouped cables retain the wider 8–10px documentation pitch.

This keeps one route per physical link and works for both the interactive canvas and static SVG/HTML/PDF exports. Split groups may span more than one device pair; each member still owns its endpoint lanes and every gutter it traverses.

The old canvas-only group guide is removed. It visually joined member routes and placed P/B circles in routing gutters even though those shapes were not physical cables. Failover roles are instead rendered as compact rectangular badges directly over the corresponding source and target sockets, after cables are painted so the badges stay legible.

## Alternatives considered

- Post-process existing paths by pulling them toward an average centerline. This can collide with unrelated reserved tracks because it bypasses the planner's occupancy state.
- Draw a shared group spine with branches. This recreates the merging and false-junction problem and makes individual physical members harder to trace.

## Verification

- Assert grouped routes use stable 5px lane offsets in faceplate and gutter segments.
- Assert fan-out members remain fully orthogonal and never share a collinear routed span.
- Assert canvas source no longer contains the synthetic group-guide renderer.
- Assert failover P/B roles are emitted on both endpoint sockets in interactive and static renderers.
