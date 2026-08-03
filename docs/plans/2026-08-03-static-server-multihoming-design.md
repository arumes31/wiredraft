# Static server multi-homing design

## Goal

Allow users to add rack servers whose physical NIC layout is defined at installation time, then connect separate server NICs to different switches, firewalls, or other devices.

## Data model

A static server remains an ordinary persisted `Device` with category `Server`. The builder creates 1–16 numbered data ports and may add a separate 1G BMC port. Existing link invariants remain unchanged: one `Link` joins exactly two physical ports, and one physical port can belong to only one link. Multi-homing therefore uses multiple server NICs instead of allowing several cables on one connector.

No persistence migration is required. Static servers use the same device, port, link, REST, JSON backup, and event synchronization contracts as catalog hardware.

## Interface

The top toolbar exposes a dedicated **+ Server** action. Its dialog collects the device name, model or role, rack height, data-NIC count, NIC medium, chassis color, and optional BMC interface. Generated devices use a server-specific rack faceplate with visible drive bays while retaining exact connector rendering and hit testing for every NIC.

## Analysis semantics

Servers are endpoints rather than layer-two transit devices. Loop detection excludes server links from the forwarding graph. Path tracing may enter or leave a server only through the selected endpoint NIC and never crosses from one server NIC to another. This prevents a dual-homed host from being reported as a switching loop or used as an implicit bridge.

## Validation

Tests cover two independent NICs linked to different network devices, rejection of a second cable on an occupied server NIC, exclusion of a dual-homed server from loop detection, and refusal to trace through a server as transit. Module-level checks verify generated server category, NIC labels, connector media, and optional BMC layout.
