# Patch-panel rear mapping and catalog ownership

## Outcome

Patch panels expose two independent termination planes per numbered jack:

- the visible **front** jack accepts one ordinary patch cord;
- the **rear** termination accepts one permanent-link mapping to another patch panel.

This models a real panel without duplicating visible ports. A front cable and a rear mapping may use the same numbered jack simultaneously, while duplicate use of either individual side is rejected atomically.

## Domain model

`Link` carries optional `sourceSide` and `targetSide` values. Missing values mean `front`, preserving every existing topology and API client. The rear-range workflow writes `rear` at both endpoints. Rear endpoints validate only on `PatchPanel` devices.

Occupancy is keyed by `(port ID, side)`, not only by port ID. Rear mappings do not change the operational status of passive panel ports, cannot receive switchport VLAN configuration, and cannot join Trunk, LACP, MC-LAG, or Failover groups.

Generated mappings from the original Panel Map implementation are recognized by their stable `Patch range` note prefix and upgraded to rear/rear during topology normalization. Intentional front-to-front panel patch cords are not inferred or changed.

## User workflow

1. Use **+ Panel** to install any built-in Generic Patch copper or fiber model.
2. Install at least two panels.
3. Open **Rear Map**.
4. Select source and target panels plus a source range and target start.
5. Review the calculated one-to-one rear pairs and choose **Connect Rear Range**.
6. Patch the visible front jacks normally; their rear mappings remain intact.

Rear runs use a dashed amber cable treatment, an explicit rear hover bubble, and a dedicated inspector that explains the independent front jack. Removing a rear map leaves any front patch and its `up` status untouched.

## Catalog ownership

The generic Device installer excludes profiles whose vendor is `Generic Patch` and category is `PatchPanel`. Those profiles remain in the shared catalog data but are presented exclusively through **+ Panel**, including Cat5e, Cat6, Cat6a, LC, SC, and MPO variants. Other equipment that happens to use the `PatchPanel` category, such as a rack PDU or lab reference plate, remains available in the generic Device installer.

## Verification

- Model tests cover one front plus one rear connection, duplicate rear rejection, invalid rear endpoints, and legacy migration.
- Handler tests cover atomic rear range creation, passive status behavior, front reuse, and rear-map removal without front-link deactivation.
- Browser unit tests cover rear planning, independent occupancy, catalog ownership, and fiber/copper model availability.
- End-to-end coverage installs a catalog-backed fiber patch panel through the dedicated Panel dialog.
