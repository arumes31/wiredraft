# Failover and backup link groups

## Outcome

Add `Failover` as a fourth persistent link-group mode beside Trunk, LACP, and MC-LAG. A failover group contains one explicitly preferred primary cable and one or more backup cables. Users create, extend, and merge these groups by dragging one cable onto another, using the existing group dialog.

## Domain model

`LinkGroup` gains an optional `primaryLinkId`. It is required when `mode` is `Failover`, must reference a member of `linkIds`, and is empty for the other modes. These are structural persistence rules. Diverse endpoints, cable media, speeds, and VLANs remain permitted because backup paths commonly use different providers and technologies.

The analyzer warns when failover members carry different VLAN sets, since that may prevent equivalent service during switchover. It does not warn merely because peer devices, media, or speeds differ.

## Interaction and rendering

The group dialog adds `FAILOVER / BACKUP`. Selecting it reveals a preferred-link selector populated with human-readable device and port endpoints for every prospective member. The selected cable is persisted as `primaryLinkId`; all other members are backups.

Canvas badges use `FAILOVER` and visually distinguish the primary member from backup members. The link inspector reports the selected cable's role and identifies the group primary. Editing, merging, extending, and removing members reuse the current link-group controls. If removing the primary from a group with more than two members, another remaining member becomes primary before the update is sent.

## Compatibility and tests

Existing topology JSON remains compatible because the new field is optional outside failover groups. Tests cover validation, analyzer VLAN warnings, create/extend/merge planning, primary selection, and primary reassignment when a member leaves. Browser module checks, Go tests, race tests, vet, and the live Docker health check remain release gates.
