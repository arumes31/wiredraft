# Configurable patch-panel tubes

## Outcome

Panel Map can divide one selected rear-port range into explicitly sized physical channels. Tube members fan out as individual strands only at the two patch panels; the shared inter-panel route is rendered as one thick tube. Adjacent rear channels retain an exact 8px boundary gap.

## Data model

The existing rear-channel UUID remains the persistent grouping key, so no topology migration or parallel channel entity is required. The mapping dialog accepts a strands-per-channel size. Planning divides the range into contiguous groups, derives one valid version-4 UUID per group, and gives each group a traceable name containing its ordinal and source-port range. Every generated link stores its assigned channel UUID, name, and construction type.

The default `ALL SELECTED RUNS` preserves the earlier one-range/one-channel workflow. Explicit sizes of 1, 2, 4, 6, 8, 12, and 24 cover microducts, common fiber tubes, and larger structured-wiring bundles.

## Rendering

Individual rear routes remain in the scene for hit testing, endpoint traceability, and panel fan-out. They are painted first. A channel sheath begins at the source panel boundary, follows the consolidated gutter and overhead corridor, and ends at the target panel boundary. Its opaque core covers the common strand rails, producing one thick physical tube while leaving the on-faceplate breakouts visible. Front patch cables remain on the upper visual layer.

Static SVG/PDF/HTML exports use the same ordering and tube geometry. The tube carries channel identity, name, construction, and strand count as export attributes.

## Verification

Tests cover deterministic channel grouping and UUID assignment, invalid group sizes, exact 8px channel spacing, panel-boundary tube endpoints, thicker tube geometry, export layer ordering, and the complete browser workflow through the API.
