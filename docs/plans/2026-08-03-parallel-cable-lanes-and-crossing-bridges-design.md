# Parallel cable lanes and crossing bridges

## Goal

Keep dense physical cabling legible without sending related cables through widely separated detours. Cables using the same corridor should run beside one another, and an unavoidable crossing should clearly show which cable passes over the other.

## Routing model

Previously routed horizontal and vertical segments contribute adjacent lane candidates at a 12-pixel centerline spacing. Routes with nearby endpoint pairs may also reuse a translated copy of the existing corridor. This lane candidate receives a bounded preference, while exact or sub-minimum parallel overlap remains penalized. The normal obstacle and port-clearance checks still reject any lane that enters equipment.

### Group-aware early bundling

Members of the same Trunk, LACP, MC-LAG, or Failover link group are routed contiguously, beginning at the first member's position in the topology link order. The first valid route becomes a preferred bundle reference for later members. References are automatically reversed when their endpoints match the follower in the opposite direction. A bounded bundle-affinity score rewards the longest safe shared corridor, so members join a parallel 12-pixel lane immediately after clearing their source faceplates and remain together until they must fan out to their real target ports. Device and port obstacles remain hard constraints: affinity cannot pull a cable through hardware or force a remote MC-LAG member into an unreasonable detour. Canvas and SVG export use the same ordering and preferred-route inputs.

Crossings remain a fallback. After the base route is selected, the later cable is compared with earlier base routes. A proper crossing with a meaningful angle and sufficient endpoint clearance replaces a short section of the upper cable with a compact cubic jump-over arc. Parallel, shallow, endpoint-adjacent, and duplicate intersections do not create bridges.

Each bridge retains the index of the lower route and a bounded opening radius. After normal cable bodies are rendered, the lower cable is redrawn only inside that opening. This makes it visibly continuous through the arch without changing cable precedence or allowing the lower stroke to cover the bridge shoulders. The radius and lift are large enough for the dark cable casing and high-speed cable widths while remaining compact at normal zoom.

## Shared geometry

The bridged route replaces the display route rather than adding a decorative overlay. Canvas strokes, VLAN animation, pulses, warnings, labels, hover hit-testing, PNG rendering, and SVG export therefore follow the same geometry. Base routes remain the inputs to subsequent route planning so the small visual jump does not distort cable-lane reservations.

## Verification

Pure JavaScript tests verify compact lane clearance, contiguous group routing, early bundle joining in both endpoint directions, non-overlap, exact bridged endpoints, visible bridge lift, separation from the underlying crossing, and the absence of bridges between parallel lanes. The complete Go, JavaScript, race, vet, SVG, Docker-health, and Graphify checks remain required.
