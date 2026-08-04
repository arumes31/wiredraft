# Multiple map creation

## Problem

The application and JSON store already support multiple topology aggregates. The top bar lists and switches existing maps, and the API can create either a blank or demo topology. Operators cannot reach that creation capability from the interface, and a browser reload always opens the most recently updated map instead of the map the operator last selected.

## Approaches considered

1. Add a compact creation control beside **ACTIVE MAP** and reuse the existing topology API. A modal asks for the map name and either a blank or starter template. The created map becomes active immediately and the active ID is remembered locally. This is the selected approach because it exposes the existing lifecycle without adding a second persistence model.
2. Build a full map administration screen with create, rename, duplicate, archive, and delete. This could be useful later, but it introduces destructive operations and broader product decisions that are not required to add another map.
3. Treat imported JSON backups as the only way to create maps. This technically works but makes routine creation dependent on a file workflow and does not offer a clean blank starting point.

## Interaction and visual design

The existing selector becomes a compact industrial map bay: its label includes the persisted map count, the selector remains the primary switcher, and a square cyan-accented plus control sits beside it. The creation dialog follows the current dark control-panel language and presents two large radio cards:

- **Blank workspace** starts with the default VLAN and an empty canvas.
- **Starter topology** starts with the existing demonstration rack, devices, cables, and VLANs.

Submitting creates the topology through `POST /api/v1/topologies`, refreshes the selector summaries, switches the application state and live event stream to the new topology, fits the canvas, and confirms the result with a toast. Failures leave the dialog open and preserve the current map.

## Persistence and recovery

Successful map loads store the active topology ID in local storage. Initialization selects that ID when it still exists; otherwise it falls back to the most recently updated map. Storage access is guarded so private or embedded browsing modes do not block the application.

## Verification

- Unit tests cover preferred-map fallback and collision-free default map naming.
- Browser tests create a blank map, confirm that it is active and empty, switch back to the prior map, then reload and confirm the last active map is restored.
- Existing unit, coverage, accessibility, and topology workflow suites remain green.
