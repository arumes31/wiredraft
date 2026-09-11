const placementFields = {
  devices: ["positionX", "positionY", "rackId", "rackUnit", "rackFace"],
  racks: ["positionX", "positionY"],
};

/** Serialize saves through their response handling, so each write sees the latest revision. */
export class TopologyWriteQueue {
  constructor() { this.tail = Promise.resolve(); this.pending = 0; }

  run(operation) {
    this.pending += 1;
    const result = this.tail.then(operation);
    this.tail = result.catch(() => {}).finally(() => { this.pending -= 1; });
    return result;
  }
}

function position(item, collection) {
  return Object.fromEntries(placementFields[collection].map((field) => [field, field === "rackFace"
    ? (item?.rackId ? item.rackFace || "front" : "")
    : item?.[field] ?? (field === "rackId" ? "" : 0)]));
}

function samePosition(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

/** Capture placement only; inventory, names and cable endpoints are never replayed by a drag. */
export function placementChanges(snapshot, collection, items) {
  return items.flatMap((item) => {
    const original = snapshot?.[collection]?.find((candidate) => candidate.id === item.id);
    if (!original) return [];
    const before = position(original, collection);
    const after = position(item, collection);
    return samePosition(before, after) ? [] : [{ collection, id: item.id, before, after }];
  });
}

/** Rebase a drop on a fresh map, rejecting an actual competing move or deletion. */
export function applyPlacements(topology, changes, { checkConflicts = false } = {}) {
  const result = structuredClone(topology);
  for (const change of changes) {
    const item = result[change.collection]?.find((candidate) => candidate.id === change.id);
    if (!item) {
      if (checkConflicts) throw new Error("This item was removed in another session. The map has been refreshed.");
      continue;
    }
    const current = position(item, change.collection);
    if (checkConflicts && !samePosition(current, change.before) && !samePosition(current, change.after)) {
      throw new Error(`${item.name || "This item"} was moved in another session. The map has been refreshed.`);
    }
    Object.assign(item, change.after);
  }
  return result;
}
