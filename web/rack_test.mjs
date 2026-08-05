import assert from "node:assert/strict";

import {
  findRackLanding,
  isRackPlacementAvailable,
  layoutRackGroups,
  mountedDevicePosition,
  rackBounds,
  RackFace,
  usedRackUnits,
} from "./static/js/rack.js";

const rack = {
  id: "rack-a",
  name: "RACK A01",
  positionX: 100,
  positionY: 200,
  heightU: 12,
  color: "#2c4b4e",
};
const device = {
  id: "device-a",
  rackId: "",
  rackUnit: 0,
  faceplate: { unitsU: 2 },
};
const topology = { racks: [rack], devices: [device] };

assert.deepEqual(rackBounds(rack), { x: 100, y: 200, width: 750, height: 1284 });
assert.deepEqual(mountedDevicePosition(rack, { ...device, rackUnit: 1 }), { x: 130, y: 1264 });

const proposedAtU5 = mountedDevicePosition(rack, { ...device, rackUnit: 5 });
const landing = findRackLanding(topology, device, proposedAtU5);
assert.equal(landing?.rack.id, rack.id);
assert.equal(landing?.rackUnit, 5);
assert.equal(landing?.isValid, true);
assert.deepEqual(landing?.position, proposedAtU5);

const occupiedTopology = {
  racks: [rack],
  devices: [
    device,
    { id: "device-b", rackId: rack.id, rackUnit: 5, faceplate: { unitsU: 2 } },
  ],
};
assert.equal(isRackPlacementAvailable(occupiedTopology, device, rack.id, 5), false);
assert.equal(isRackPlacementAvailable(occupiedTopology, device, rack.id, 5, RackFace.REAR), true);
assert.equal(findRackLanding(occupiedTopology, device, proposedAtU5)?.isValid, false);
assert.equal(usedRackUnits(occupiedTopology, rack.id), 2);
assert.equal(usedRackUnits(occupiedTopology, rack.id, RackFace.FRONT), 2);
assert.equal(usedRackUnits(occupiedTopology, rack.id, RackFace.REAR), 0);
assert.equal(findRackLanding(occupiedTopology, device, proposedAtU5, { [rack.id]: RackFace.REAR })?.isValid, true);
assert.equal(findRackLanding(topology, device, { x: 2000, y: 2000 }), null);

const smallRack = { ...rack, id: "rack-small", heightU: 6 };
const oversized = { ...device, id: "device-tall", faceplate: { unitsU: 12 } };
const capacityLanding = findRackLanding(
  { racks: [smallRack], devices: [oversized] },
  oversized,
  { x: smallRack.positionX + 30, y: smallRack.positionY + 64 },
);
assert.equal(capacityLanding?.isValid, false);
assert.equal(capacityLanding?.reason, "capacity");
assert.equal(capacityLanding?.rackUnit, 1);

const movedRack = { ...rack, positionX: 300, positionY: 400 };
assert.deepEqual(mountedDevicePosition(movedRack, { ...device, rackUnit: 5 }), { x: 330, y: 1064 });

const neighborRack = { ...rack, id: "rack-b", positionX: 900 };
const packed = layoutRackGroups([rack, neighborRack], new Set([rack.id, neighborRack.id]));
assert.equal(packed.get(rack.id).x, rack.positionX);
assert.equal(packed.get(neighborRack.id).x, rack.positionX + 750 * 2 + 90 + 90,
  "a neighboring rack must move beyond both expanded faces and their clearance");
const lowerRack = { ...neighborRack, id: "rack-c", positionX: rack.positionX, positionY: 1800 };
assert.equal(layoutRackGroups([rack, lowerRack], new Set([rack.id])).get(lowerRack.id).x, lowerRack.positionX,
  "racks with separated vertical spans must retain their saved horizontal position");

console.log("rack placement checks passed");
