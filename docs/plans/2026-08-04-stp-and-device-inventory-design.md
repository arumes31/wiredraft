# STP simulation and device inventory metadata

## Scope

Implement ideas 531 and 596–603 from `ideas2.md`: VLAN-aware STP simulation plus serial number, asset tag, hostname, management IP, structured location, and responsible team metadata.

## STP topology model

STP runs on logical bridges rather than raw chassis. Every standalone switch is one bridge. Members of a saved Stack, VSF, MC-LAG, StackWise, VSS, Virtual Chassis, IRF, or custom switch system collapse into one bridge while retaining their physical device and port identities in results.

For each VLAN, links whose endpoint ports both carry that VLAN become candidate edges. Members of a Trunk, LACP, or MC-LAG link group between the same logical bridge pair collapse into one logical edge; Failover contributes only its primary member. Links inside one logical switch system are internal and do not create STP cycles. This prevents parallel aggregation members from being reported as false loops.

The root bridge is selected by the lowest configured bridge priority, then a stable logical bridge ID. A deterministic breadth-first tree calculates path cost in link hops. Parent edges provide the child's Root Port and the parent's Designated Port. Non-tree segments elect their designated side by path cost, priority, and stable ID; the peer side is Blocked. Each physical member port receives the logical edge role, so faceplates and inspectors remain accurate.

## Persistence and UI

Device metadata is stored directly on `Device`; location uses site/building/floor/room/rack/rack-unit fields. Optional IP values must be literal IPv4 or IPv6 addresses. Hostnames use DNS-compatible labels. The existing device update endpoint persists all fields atomically.

The device inspector exposes identity, management, ownership, location, and STP priority. A dedicated Spanning Tree rail shows one expandable card per VLAN with root, blocked ports, and root convergence paths. Clicking a path reuses the existing trace overlay. Faceplate ports receive small `R`, `D`, or `B` state badges; blocked state takes precedence when VLAN instances differ.

## Verification

Tests cover root election, triangle blocking, aggregated links, logical switch systems, failover primary selection, metadata validation, JSON persistence, inspector contracts, and browser interaction.
