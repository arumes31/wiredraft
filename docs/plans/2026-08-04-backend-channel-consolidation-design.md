# Backend channel consolidation

## Outcome

Rear patch-panel mappings use a deterministic two-tier route plan. Every unordered source/target panel pair owns one overhead corridor, while each range saved through Rear Map becomes a named inner channel. New mappings persist a channel ID, name, and construction; legacy mappings remain compatible and derive four-port channels from physical port order and cable media.

## Channel planning

The planner sorts rear links by canonical panel pair and physical port position. Explicit channel IDs keep every member of a saved range together, including ranges that cross a four-port boundary. The Rear Map dialog offers Tube / Bündelader, Discrete Bundle, or automatic construction; automatic mode resolves fiber to a tube and copper to a discrete bundle. Legacy ports 1–4, 5–8, and subsequent four-port blocks form derived channels. Tube strands use a 2.5-pixel pitch, discrete cables use a 4-pixel pitch, adjacent channel boundaries retain 21 pixels, and separate panel-pair corridors retain 24 pixels.

Every strand remains an independent Manhattan route with its own source spine X, overhead Y, destination spine X, and faceplate micro-lanes. Rear routes always rise through the rack's outer backend bank, cross above the rack envelopes, and descend at the destination gutter before entering the exact port. Front and rear gutter coordinates remain segregated.

## Rendering

Tube channels receive one shared, semi-transparent sheath centerline behind their strands. The sheath is visual only and never replaces the individual routes used for hit testing, hover focus, inspection, or export traceability. Hovering one member focuses the whole physical channel. Discrete bundles have no sheath. Both live Canvas rendering and SVG/HTML/PDF documentation use the same route metadata and layer the sheath below dashed backend strands and solid front patch cables.

## Verification

Routing tests cover a 12-strand inter-rack panel pair split into two tube channels and one discrete bundle. Assertions verify the 2.5/4-pixel strand pitches, 21-pixel channel clearance, unique spine tracks, overhead-only traversal, orthogonal destination breakouts, and sheath ownership. Export tests verify sheath order and channel metadata without changing the established rear-link dash and opacity.
