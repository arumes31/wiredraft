# VLAN-colored rainbow cables

## Visual behavior

Every physical link derives its color from persisted VLAN configuration. A link carrying one VLAN is a solid cable in its native VLAN color. A link carrying multiple VLANs keeps the native VLAN as a continuous outer edge and renders every carried VLAN as a repeating colored band inside the cable. The bands move along the live canvas path, retaining the existing traffic direction cue without adding a second overlay or widening the cable across nearby ports.

The native VLAN is always the first palette entry even when normalized VLAN IDs are numerically sorted. Remaining VLANs are ordered by VLAN ID for deterministic rendering. Unknown or legacy VLAN IDs use the existing neutral cable color.

## Shared rendering model

`link-vlan-colors.js` converts a topology and link into a native color plus an ordered channel palette. It also calculates the repeated band pattern. The canvas and SVG exporter consume the same functions, while PNG export inherits the canvas rendering. This keeps interactive and exported diagrams visually consistent.

Band cycles are bounded so all VLAN colors repeat frequently on normal cable lengths. A dark sheath preserves contrast over racks and faceplates. Backup-link opacity, selection halos, warnings, routing, hit testing, and hover labels remain independent of the VLAN color layer.

## Verification

Pure module tests cover native-color selection, complete VLAN ordering and de-duplication, missing-color fallback, single-VLAN behavior, and rainbow band spacing. Existing routing, grouping, link configuration, canvas interaction, and export behavior remain covered by the full frontend and Go suites.
