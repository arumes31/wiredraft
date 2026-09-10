# Hardware faceplates

WireDraft renders physical front and rear panels from one shared scene. Canvas,
SVG export, picking and cable attachment use the same connector geometry.
`web/static/js/faceplate-models.js` resolves an explicit vendor/model registry;
the vendor modules link to the manufacturer's panel drawings.

## Evidence and fidelity

A `model` profile must trace both panels of the named hardware. Its metadata
records the source, relevant pages or images, and any selected hardware revision,
power supply population or other configuration. Common drawing primitives may
be shared; port counts, bank placement, service connectors and rear cooling must
follow the individual model. A nearby model or a family datasheet without the
required panel drawing does not establish the missing layout.

Use manufacturer specifications and panel drawings where available. An original
photograph of the exact review unit can establish a missing panel when its source
and pictured configuration are identified explicitly and corroborated by the
manufacturer's specifications. Record that photograph's actual provenance;
do not describe it as manufacturer artwork or redistribute it in the application.

The remaining `family` profiles are provisional. `schematic` identifies
configurable equipment whose actual hardware population is unspecified. These
states appear in the inspector and must not be counted as finished model layouts.
The catalog-wide conversion remains in progress until every applicable entry
passes the strict audit. Combined model names and chassis families require an
exact SKU or explicit configuration before their drawing can be verified.

Run `npm run audit:faceplates` to check both panels of every catalog entry for
finite bounds, duplicate or missing inventory identities, overlapping sockets,
and collisions with hardware components. Run
`node scripts/audit-faceplates.mjs --require-model-specific --json` to list all
remaining named hardware that lacks a verified model layout. The strict command
intentionally fails while that backlog exists.

## Correcting catalog inventories safely

New devices receive the current catalog connector types, counts and speeds.
Existing saved port IDs, user labels, configuration and cable references remain
intact when the physical drawing changes. A historical endpoint with no real
socket appears in the application connection marker as unmapped inventory;
the renderer must not invent an extra physical connector.

When a correction changes the meaning of an inventory index, increment the
catalog profile's `inventoryRevision` and set the same revision on the physical
profile. `instantiateProfile` saves it in `device.faceplate.inventoryRevision`.
The Go `FaceplateSpec` preserves that optional field through save/load; absent
or zero identifies the original catalog inventory. Catalog refresh does not
rewrite a device across revisions.

Provide an explicit mapping for each supported old revision:

```js
{
  inventoryRevision: 1,
  legacyLayouts: [{
    inventoryRevision: 0,
    portIndexMap: { 1: 1, 2: 2, 17: 9 },
    portLabels: { 17: "MGMT1" },
  }],
}
```

The map is old index to current physical slot index. Enumerate every retained
endpoint, including unchanged indices. An omitted old index stays unmapped;
it must never fall through to the current index or match a coincidental label.
Unknown revisions also remain unmapped. Never select a revision by port count,
array order or display name. Add regression tests for renamed and reordered
historical inventory, especially when an obsolete port and a new service socket
share the same index and media type.

`portLabels` is optional and records known old generated labels. Together with
the slot's `physicalLabel`, it allows printed hardware numbering to appear for
an unchanged default name while preserving user renames. `compatibleTypes`
permits an explicitly documented historical media assignment to bind to the
correct socket. `connectorKind` selects the real socket artwork without
modifying the saved port's type.

## Rendering and verification

Model coordinates are normalized connection-planning illustrations, not
manufacturing measurements. Application identity and connections on hidden
panels occupy a title strip outside the physical body. Round or square access
point chassis retain their aspect ratio. Port labels have bounded space shared
by Canvas and SVG; exported widths remain constrained across font substitution.
An individual slot can reserve a caption with `descriptionAnchor: { x, y }` in
normalized chassis coordinates when nearby service hardware blocks the default
placement. Dense panels may also supply `fontSize` and `boxHeight`, measured in
scene pixels. Fonts are bounded to 5.5–8 pixels and plates to 7–11 pixels, with at
least 1.5 pixels beyond the font size. Omitted or invalid dimensions retain the
default font or 11-pixel plate. Both renderers use these same dimensions when
fitting adjacent captions. Keep the complete caption plate inside the device bounds and verify its
clearance in both renderers; the anchor never changes the socket or cable position.
Unmounted round and square access points receive enough display height to keep
their sockets readable. Rack occupancy still uses the saved physical rack units.
New hardware is placed below existing devices in its canvas column; saved device
positions remain unchanged. Drag ghosts, picking, routing and exports use the
same display bounds.

Run `npm run test:coverage` for unit and compatibility checks and the existing
80% coverage gates. `e2e/faceplate-catalog.spec.mjs` renders both panels of the
entire catalog in the real application, compares Canvas/SVG port identities,
checks selected-face export and exercises dense-label rendering. Rebuild the
Go server before running this browser test because frontend assets are embedded.
Inspect each new model's rendered front and rear against the cited source;
passing a geometry test alone is not evidence of physical accuracy.

`e2e/catalog-persistence.spec.mjs` creates a separate blank map and saves actual
catalog devices covering every connector type, then reloads their inventories
and removes the map. This catches frontend/backend type mismatches that a
render-only check cannot detect. Add each new connector type to both the Go
port validation and the catalog registration whitelist before using it.
