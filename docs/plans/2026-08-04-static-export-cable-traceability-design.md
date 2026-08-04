# Static export cable traceability

## Goal

Make dense cable tracks readable in interactive and static documentation while preserving the individual-track, zero-extension faceplate routing model. Parallel gutter tracks use a 9px pitch. Normal faceplate micro-lanes use an 8px pitch; when a high-density 1U faceplate cannot physically hold every endpoint at that pitch, allocation keeps every lane unique and compresses only the overflowing lanes inside the device boundary.

## Selected approach

Three approaches were considered. Export-only decoration is small but would make PNG/PDF/SVG disagree with the interactive canvas. Converting every renderer to an SVG DOM would provide one drawing backend but would significantly expand runtime and hit-testing work. The selected approach retains the shared route model and adds explicit bridge metadata plus shared endpoint-label placement. Canvas and SVG consume the same metadata, while PNG and PDF inherit the canvas export pass.

Crossings are detected for every route pair after batch track assignment. Only perpendicular horizontal/vertical intersections qualify. The horizontal route always owns a 5px semicircular jumper arc, independent of link ordering. Intersections near endpoints, adjacent bridges, parallel tracks, and collinear segments are excluded. Base Manhattan segments remain authoritative for track reservation and hit testing; rendered paths replace only the short horizontal span around each crossing with an arc. A final clipped bridge pass redraws the horizontal owner so a later vertical cable cannot cover the bow.

## Static documentation

Static render passes add compact badges near both route ends. The source-side badge names the remote target rack and port; the target-side badge names the remote source rack and port. Dark badge fill, a pale border, condensed text, and collision-aware offsets keep labels readable without resembling interactive controls. SVG paths receive an explicit dark outline approximately 1px outside the colored rail. Canvas export uses the equivalent casing before the colored cable layers. Transient hover and selection decoration remain excluded.

## Verification

Pure routing tests cover 9px gutters, 8px preferred faceplate lanes, order-independent horizontal bridge ownership, 5px arc metadata, endpoint clearance, and unchanged Manhattan base geometry. Export tests verify SVG arc commands, bridge layering, endpoint badges, safe text escaping, and outlined colored paths. Canvas contract tests verify arc drawing and export-only endpoint labels. The JavaScript suite, Go suite, Chromium export workflow, Docker build, health check, and live-container smoke test remain release gates.
