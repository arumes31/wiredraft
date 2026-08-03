# Link bundle visualization and collision-free labels

## Outcome

Grouped physical links should read as one logical relationship rather than several duplicated cable badges. Trunk, LACP, MC-LAG, and Failover groups receive one shared two-line nameplate. Individual ungrouped cables keep their VLAN nameplate. A deterministic placement pass ensures nameplates do not overlap one another.

## Group presentation

The primary line contains the group mode and configured name. The secondary line explains the relationship:

- Trunk: physical member count and union of carried VLANs.
- LACP: both peer device names and member count.
- MC-LAG: the common endpoint, peer-switch names, and member count.
- Failover: primary endpoint relationship and backup count.

Each grouped cable receives a small colored membership tick at its midpoint. The single group nameplate points to the bundle centroid with a subtle leader, so the logical relationship stays visible without covering each physical cable.

## Collision-free placement

Canvas rendering first calculates every cable curve, then measures all proposed nameplates. Group plates are placed before single-cable plates. Candidates sample multiple positions along each Bézier and several normal offsets; group candidates expand around the bundle centroid. A candidate is accepted only when its padded rectangle does not intersect an already placed nameplate. Device faceplates are treated as preferred-avoidance obstacles.

If all preferred positions are blocked, an expanding deterministic search continues until it finds a rectangle that does not overlap another nameplate. This guarantees nameplate-to-nameplate separation even in dense diagrams. A leader line is drawn whenever a plate moves away from its cable anchor.

## Verification

Pure helpers cover peer summarization, MC-LAG common-side detection, rectangle collision, deterministic placement, and dense fallback behavior. Existing canvas, rack, faceplate, link-group, Go, race, vet, Docker, and graph-integrity checks remain required.
