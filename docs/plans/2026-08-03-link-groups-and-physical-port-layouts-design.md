# Link groups and physical port layouts design

## Goals

Allow an operator to drag one existing cable onto another and persist the relationship as a Trunk, LACP, or MC-LAG group. Replace generated connector labels with documented physical interface names and ordered layouts so group validation and diagrams refer to the same names printed on real hardware.

## Persistent link groups

`Topology` owns a `linkGroups` collection. A group has a UUID, operator-visible name, mode (`Trunk`, `LACP`, or `MCLAG`), member link IDs, and optional notes. A physical link can belong to at most one group. Groups require at least two existing links. Deleting a link or device removes stale membership and automatically removes groups that fall below two members.

Dragging begins only after pointer movement exceeds a small threshold, preserving ordinary click-to-select behavior. During a drag, compatible target cables highlight. Dropping opens an industrial patch-operation dialog showing both endpoint pairs and the three group modes. Dropping a cable onto a member of an existing group adds it to that group; dropping between different groups offers to merge membership under the chosen mode.

Structural errors such as missing links, duplicate members, or a link in two groups are rejected by persistence validation. Protocol-shape problems are advisory: LACP members that do not connect the same device pair, MC-LAG members that do not span peer devices on exactly one side, mismatched speeds/media, and trunk members with inconsistent VLAN sets are saved but reported by the topology analyzer.

## Rendering and controls

Grouped cables retain their individual VLAN colors and physical endpoints. A compact mode badge is placed near each member cable, and dragging highlights the prospective target without moving cable geometry. The link inspector shows group name, mode, members, warnings, and an action to remove the selected cable from the group. Dialog controls are keyboard accessible, support Escape/cancel, and never mutate state until Apply succeeds.

## Source-backed physical ports

Catalog groups accept an explicit ordered `labels` array and optional normalized positions. Profile instantiation uses those values verbatim. Generated prefixes remain only as an import-compatible fallback and are marked as inferred metadata.

Fixed appliances use official hardware guides, front-panel diagrams, architecture pages, or vendor specifications. Variants inherit a layout only when their connector panels are documented as identical. Modular chassis expose fixed management and console interfaces without inventing line-card ports. Switch port banks retain their printed numbering and vendor management/console names. Every built-in profile records whether labels are exact, family-equivalent, modular, or inferred, plus its source URL.

## Verification

Go tests cover normalization, validation, CRUD, deletion cleanup, and advisory analyzer findings. JavaScript tests cover drag thresholds, target selection, group creation/extension payloads, exact label resolution, alias inheritance, catalog-wide metadata coverage, and SVG labels. Full race tests, vet, syntax checks, Graphify integrity, Docker health, and HTTP checks remain required.
