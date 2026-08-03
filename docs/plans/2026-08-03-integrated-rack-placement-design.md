# Integrated rack placement design

## Goal

Add Rackula-inspired rack planning to the existing topology canvas without splitting physical placement from cabling. Users can create and move several racks, snap network devices and servers into whole rack units, move equipment between racks, and return equipment to free space.

## Domain model

`Topology` gains an initialized `racks` collection. A `Rack` has a persistent ID, name, canvas position, height in rack units, and color. `Device` gains optional `rackId` and `rackUnit` fields. A zero rack unit means the device is free-floating; mounted devices use one-based units measured from the bottom of the rack.

Existing topology JSON remains valid because normalization initializes a missing rack collection and clears no device coordinates. Rack placement is authoritative for mounted rendering, while the device's absolute coordinates are refreshed when it is mounted or released so exports and older clients retain useful positions.

Validation requires rack IDs to be unique, rack height to remain between 6U and 48U, mounted devices to reference an existing rack, and each device's occupied U range to fit without overlapping another mounted device. Free-floating devices retain the current coordinate behavior.

## Interaction and rendering

The toolbar exposes **+ Rack**. The creation dialog collects rack name, height, and frame color. Racks render behind cables and faceplates with numbered rails, a high-contrast header, capacity status, and one visual slot per U.

Racks move by their header and carry mounted device render positions with them. Dragging a device over a rack shows a whole-U landing preview. A valid preview snaps to the nearest available range; an invalid range displays a red collision state. Dropping outside every rack clears the mount and leaves the device at its free-space coordinates. Deleting a rack releases its equipment at their last rendered positions instead of deleting devices or links.

## API and state flow

Rack creation, update, and deletion use topology-scoped REST resources and the existing atomic store update plus SSE publication flow. Device mounting continues through device updates, so undo/redo and remote synchronization use the established topology snapshot mechanism.

Canvas callbacks report rack changes and device changes to the application controller. Selection gains a rack type so the inspector can rename, recolor, resize, or delete a rack and can show used and available capacity.

## Scope

The first release supports front-facing, full-width, whole-U devices. Rear mounting, half-width carriers, shelves, and nested containers remain outside this change.

## Verification

Domain tests cover normalization, rack validation, capacity boundaries, overlapping U ranges, and rack deletion release behavior. Handler tests cover rack CRUD. Browser-module checks cover landing calculations, collision rejection, mounting, release, and rack movement. Full Go tests, race detection, vet, JavaScript syntax checks, and export smoke checks complete verification.
