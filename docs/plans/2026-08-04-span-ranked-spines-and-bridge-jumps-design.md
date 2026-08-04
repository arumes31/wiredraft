# Span-ranked vertical spines and bridge jumps

## Goal

Minimize visual crossings in rack-side and inter-rack cable spines without merging physical links or sacrificing deterministic routing. Short links should occupy lanes nearest the rack edge, while successively longer links expand outward. Any remaining perpendicular crossing must read as two independent cables in both the live canvas and static exports.

## Lane allocation

The batch router calculates each descriptor's vertical span as the absolute difference between its source and target port center Y coordinates. Before reserving any corridor ordinal, descriptors are sorted by span ascending, then by canonical endpoint geometry and stable link ID. Because corridor counters are shared by their physical spine key, the first reservation is always the shortest link on that spine and therefore receives the innermost lane.

Bundle members use the same ordering, retaining their existing 3–5px or backend channel pitch. Rear channel blocks remain atomic to preserve Tube/Bündelader sheaths and discrete-bundle clearance; blocks are ordered by their maximum member span, and strands are ordered by their individual span inside each block. Route metadata records the measured span, spine keys, and assigned lane index for inspection and regression testing.

Incremental geometry changes expand to every cached route sharing an affected spine. This is necessary because moving one endpoint may change the relative span order; reusing an old neighbor lane would violate the concentric nesting invariant. Metadata-only updates still reuse the complete plan.

## Permitted crossings

Base paths remain strict Manhattan polylines. The crossing decorator considers only proper horizontal-to-vertical intersections, excluding endpoints, parallel segments, and nearby duplicate jumps. The horizontal front cable owns a semicircular bridge with a 4px default radius constrained to 3–4px. Backend lines retain their lower-layer rule and never receive a bow.

Canvas and SVG renderers consume the same bridge metadata and replace only the small horizontal crossing interval with the arc. The underlying reserved path, hit testing, labels, warnings, hover highlighting, and route caching remain unchanged.

## Verification

Routing tests cover span ordering across unrelated device pairs sharing a rack spine, stable tie-breaking, compact trunk/rear channel ordering, orthogonal geometry, and 3px/4px bridge radii. Incremental tests verify that a moved member invalidates its whole shared spine. Export tests verify the identical 4px SVG arc.
