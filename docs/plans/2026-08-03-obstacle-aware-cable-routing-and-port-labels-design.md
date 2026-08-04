# Obstacle-aware cable routing and visible port labels

> Superseded by [Individual-track cable routing](./2026-08-04-individual-track-cable-routing-design.md), which replaces cubic routes and outer vertical stubs with zero-extension orthogonal faceplate exits and rack gutters.

## Outcome

Cables remain visible between their endpoints instead of passing behind unrelated equipment. A connected cable may cover only its own connector and the shortest exit path from that connector; it should avoid other port banks whenever the topology leaves a viable route. Permanent physical interface names remain readable above cable terminations.

## Routing model

Each link becomes a route containing one or more cubic Bézier segments. The first and last segments run from the real port center to the nearest top or bottom faceplate edge. This minimizes travel across the chassis and keeps a top-row cable above the top row and a bottom-row cable below the bottom row.

Endpoint leads are port-normal: a cable travels vertically from the exact port center through either the top or bottom faceplate edge without lateral displacement. The router prefers the nearest edge, but may choose the opposite edge when the direct lead would cross another port. Lane separation, bundle affinity, obstacle detours, and rounded corners begin only after this straight faceplate exit; they never pull the cable sideways across the device surface.

The middle route evaluates direct, horizontal-lane, and vertical-lane candidates around expanded device rectangles. The shortest valid candidate wins, with a small bend penalty so routes remain calm and predictable. Candidate lanes include the outside perimeter, providing a route around densely packed devices. Interior corners are rounded while endpoint exits stay exact, preserving the physical cable-to-port connection.

Route calculation is deterministic and cached by endpoint and device geometry. Selection, hit testing, pulses, warnings, group markers, nameplates, PNG rendering, and SVG export consume the same multi-segment route.

## Rendering order and port descriptions

Cable bodies render behind equipment but are routed outside unrelated faceplates. Device bodies and ports render next. Only the first and last route segments are repeated above their owning device, so a cable visibly reaches its actual connector without appearing across other equipment.

Physical port names render after cable terminations. Each name uses a compact, high-contrast silkscreen badge derived from the faceplate palette. Top-row names sit above their sockets and bottom-row names below them, keeping descriptions from opposing rows separated. Long documented names use a condensed smaller size rather than disappearing.

## Alternatives considered

Drawing all cables above every device guarantees visibility but obscures controls and unrelated ports. Keeping the original single Bézier and adding bridge marks handles isolated crossings but cannot prevent long sections from disappearing behind a chassis. Obstacle-aware multi-segment routing provides the clearest result without changing persisted topology data.

## Verification

Pure JavaScript tests verify deterministic routing, obstacle clearance, exact endpoints, route hit testing, and port-label placement. Existing faceplate, rack, link-group, label-layout, Go, race, vet, SVG layer, Graphify integrity, and Docker health checks remain required.

## Foreground single-path revision

User testing showed that repeating only the endpoint segments above the chassis looked like a second cable laid over the original. The canvas and SVG exporter now render each complete routed cable once, after the device faceplates. Because the route already avoids unrelated device and port rectangles, this keeps the cable continuously visible while allowing only its endpoint leads to cross the owning faceplates. Port descriptions remain the final layer so interface names stay readable.

Trunks use one primary-VLAN cable stroke plus the moving activity pulse; their complete VLAN set remains available in the hover nameplate and inspector. Previously routed cables are soft reservations in the route score. Later cables choose a separate clear lane when available, but may share constrained space rather than failing to render.
