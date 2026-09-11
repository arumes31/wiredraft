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

Any `family` profile is provisional. `schematic` identifies
configurable equipment whose actual hardware population is unspecified. These
states appear in the inspector and must not be counted as finished model layouts.
The catalog-wide strict audit requires every named hardware entry to have a
verified model layout. Combined model names and chassis families require an
exact SKU or explicit configuration before their drawing can be verified.

Run `npm run audit:faceplates` to check both panels of every catalog entry for
finite bounds, duplicate or missing inventory identities, overlapping sockets,
and collisions with hardware components. Run
`node scripts/audit-faceplates.mjs --require-model-specific --json` to list all
remaining named hardware that lacks a verified model layout. The strict command
fails whenever such a backlog exists.

## Correcting catalog inventories safely

New devices receive the current catalog connector types, counts and speeds.
Existing saved port IDs, user labels, configuration and cable references remain
intact when the physical drawing changes. A historical endpoint with no real
socket appears in the application connection marker as unmapped inventory;
the renderer must not invent an extra physical connector.

When the verified model contains a real socket that has no corresponding saved
endpoint, the scene draws it as inactive hardware. These supplemental components
preserve the model's connector geometry and orientation but have no port ID,
editable caption, hit region or cable target. They never enlarge a saved inventory.
Only verified model panels receive this artwork; family and schematic drawings
do not infer missing hardware. Regression checks must include complete, sparse,
reordered and historical inventories so restored sockets cannot overlap captions
or be drawn twice.

When a correction changes the meaning of an inventory index, increment the
catalog profile's `inventoryRevision` and set the same revision on the physical
profile. `instantiateProfile` saves it in `device.faceplate.inventoryRevision`.
The Go `FaceplateSpec` preserves that optional field through save/load; absent
or zero identifies the original catalog inventory. Catalog refresh does not
rewrite a device across revisions.

If a verified drawing reuses an already-correct inventory, set the catalog-only
`preserveInstalledPorts: true` flag. Catalog refresh then leaves both complete
and intentionally sparse saved inventories untouched, including default numeric
labels with edited speeds or groups. This flag is not saved in `FaceplateSpec`
and does not replace revision mappings when index meanings change.

Provide an explicit mapping for each supported old revision:

Derive historical indices by running the earlier catalog constructor, then
record its actual types and labels in the regression fixture. Declaration order
alone is insufficient: `instantiateProfile` places access groups first, all
uplink groups (including stack links) next, management groups after them, and
appended access groups last. Use `inventoryAppend` only for access groups that
must be placed last; applying it to uplink or management groups duplicates those
groups in the current constructor. Assert the complete new inventory count as
well as the historical mapping.

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

Irregular mounted hardware may set `chassis.componentDrawn: true` when its
authored components provide the complete body and mounting brackets. Canvas and
SVG then omit the generic body rectangle; selection outlines, saved allocation,
picking and cable geometry remain unchanged. Only a literal boolean enables
this behavior. The two rugged FortiSwitch profiles use it so caption gutters
do not look like an invented mounting plate. Keep source body proportions
separate from the surrounding mounting and caption envelope, and test both the
opt-in and ordinary rendering paths.

The audit recognizes `hardwareLayer: "chassis-container"` only on authored
`panel` or `mounting-bracket` components, and only when a socket lies wholly
inside their bounds. This permits a body behind its own sockets without
ignoring edge crossings or collisions with fans, supplies, screws or USB
hardware. Caption-background metadata alone never exempts a collision.

The audit recognizes `hardwareLayer: "chassis-container"` only on authored
`panel` or `mounting-bracket` components, and only when a socket lies wholly
inside their bounds. This permits a body behind its own sockets without
ignoring edge crossings or collisions with fans, supplies, screws or USB
hardware. Caption-background metadata alone never exempts a collision.

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

Telephone modem sockets use `POTS_RJ11`, separate from `DSL_RJ11`. New POTS
endpoints start unconfigured, without PoE or Ethernet VLANs. Cable creation uses
the shared `defaultCableProperties` helper to select `TELEPHONE` media and no
VLANs when either endpoint is POTS; it does not rewrite either endpoint's saved
settings. The persistence check also saves and reloads a telephone cable between
two actual catalog modems.

Large source chassis fitted into a smaller saved rack allocation can opt out of
unreadable physical captions with `descriptionAnchor.hidden: true`. Only the
literal boolean enables this option; normal caption readability limits remain
unchanged. The selected Nexus 7009 uses it below half its native body scale,
where the old 2U placeholder cannot fit its 14U source card labels. Canvas and
SVG retain every mapped socket and cable anchor. Hover tooltips, the selected
port inspector, and SVG port groups, titles and names retain the full saved
label; only the small physical caption is omitted. Native-size labels normally
remain visible. Source-oriented vector legends may replace horizontal caption
plates on rotated modular cards, as on the SRX5800; verify every physical legend
and retain the same full saved names and interactive identities.
`web/faceplate_caption_visibility_test.mjs` verifies this separation.

## Rack catalog additions

These entries select specific configurations. They do not infer the installed
hardware of an existing user device. New instances start at inventory revision 1;
renamed, reordered or sparse saved endpoints retain their IDs and cable anchors.
Unversioned records under these newly introduced model names have no historical
socket mapping and remain explicitly unmapped.

| Catalog model | Selected configuration |
| --- | --- |
| ThinkSystem SR650 | 7X06CTO1WW, eight LFF SATA bays, four-port X722 1Gb LOM, dual 750W supplies |
| ThinkSystem SR650 V2 | 7Z73CTO1WW, twelve LFF SATA bays, four-port I350 1Gb OCP, dual 1100W supplies |
| IBM System x3550 M5 | Type 5463 CTO, eight SFF bays, four embedded 1Gb ports, dual 550W supplies; Lenovo-maintained documentation |
| Lenovo DE2000H | 7Y71A001WW SFF, Gen1 dual controllers, four 16G FC cages, four SAS expansion sockets, covered HICs |
| Lenovo DE240S | 7Y68A000WW, 24 SFF bays, dual four-port IOM12 modules |
| Lenovo D1212 / D1224 | 4587EKU / 4587A31, 12 LFF / 24 SFF drives, dual three-port SAS ESMs |
| IBM TS2900 | 3572-S7H LTO7 with rack kit, nine-position internal magazine, one external mini-SAS socket |
| Cisco C8200-1N-4T | Base AC configuration, two copper and two SFP GE ports, covered NIM/PIM positions |
| Aruba 2530-48G / 2530-24G | J9775A / J9776A, non-PoE, four 1G SFP uplinks |
| HPE OfficeConnect 1920S 24G 2SFP | JL381A, non-PoE, fanless, in-band management |
| SEH myUTN-80 | RMK1 rack kit, closed locking lid, front 100Mb LAN, rear DC input; eight USB dongle sockets remain inside |
| RAD ETX-203AX | Original plastic GE/2SFP/2SFP2UTP, four SFP and two copper GE ports, management and control; schematic rack shelf |
| Eaton 9PX 5000 | Original 9PX5KiRT, 230V, 3U, eight C13 and two C19 outputs, no optional network card |
| Eaton 9PX EBM | Matching original 9PXEBM180RT, 180V, 3U |
| Eaton 5PX 3000 | Original 5PX3000IRT2U, 230V, 2U, eight C13 and one C19 output, no optional network card |
| Generic rack power strips | Separate 1U eight-Schuko and eight-C13/two-C19 schematics, each with a rear C20 input |

Each model module records the manufacturer document, exact panel figures and
installed population. A manufacturer-authored document obtained from a public
mirror retains its actual provenance. The RAD shelf and generic power strips
are explicitly schematic accessories; their geometry is not attributed to an
unverified manufacturer SKU. Wisenet, OmniPCX and Cisco 800 require an exact
model/chassis selection before a model-specific faceplate can be added.

Storage media use `SAS_MINI_HD_12G` (SFF-8644), `SAS_MINI_6G` (SFF-8088) and
`FC_SFP_16G`. FC uses an SFP cage without claiming an installed optical module.
These ports start unconfigured without Ethernet VLANs. New storage cables use
SAS or fiber media, and Power endpoints use power cables, also without VLANs.
Their port inspectors preserve saved speeds, modes and VLAN fields when changing
labels or media. Physical cable edits use the revision-aware
`PUT /api/v1/topologies/{id}/links/{linkId}/media` endpoint with only `cableType`;
this changes the selected cable without synchronizing endpoints or grouped links.
Power is a generic cable anchor: no electrical load, voltage compatibility,
battery protocol or UPS operation is simulated. Internal USB, monitoring and
service interfaces drawn as ancillary parts never acquire cable endpoints.
