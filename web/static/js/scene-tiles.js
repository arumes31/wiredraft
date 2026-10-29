// Bounds that would enumerate more tiles than this are not tiled: inserts go to
// an untiled list and queries scan every item. Coordinates from saved maps are
// therefore never trusted to drive an unbounded loop.
export const MAX_TILES_PER_OPERATION = 4096;

export class SceneTileIndex {
  constructor(tileSize = 1200) {
    this.tileSize = tileSize;
    this.tiles = new Map();
    this.items = [];
    this.untiled = [];
  }

  clear() {
    this.tiles.clear();
    this.items = [];
    this.untiled = [];
  }

  insert(item) {
    this.items.push(item);
    const keys = this.keys(item);
    if (!keys) {
      this.untiled.push(item);
      return;
    }
    for (const key of keys) {
      const bucket = this.tiles.get(key) || [];
      bucket.push(item);
      this.tiles.set(key, bucket);
    }
  }

  query(bounds) {
    const keys = this.keys(bounds);
    if (!keys) return this.items.filter((item) => intersects(bounds, item));
    const result = new Set(this.untiled);
    for (const key of keys) {
      for (const item of this.tiles.get(key) || []) result.add(item);
    }
    return [...result].filter((item) => intersects(bounds, item));
  }

  /** Tile keys covering bounds, or null when the range is unsafe or over budget. */
  keys(bounds) {
    const left = Math.floor(bounds.x / this.tileSize);
    const top = Math.floor(bounds.y / this.tileSize);
    const right = Math.floor((bounds.x + bounds.width) / this.tileSize);
    const bottom = Math.floor((bounds.y + bounds.height) / this.tileSize);
    if (![left, top, right, bottom].every(Number.isSafeInteger) || right < left || bottom < top) return null;
    const columns = right - left + 1;
    const rows = bottom - top + 1;
    if (columns > MAX_TILES_PER_OPERATION || rows > MAX_TILES_PER_OPERATION || columns * rows > MAX_TILES_PER_OPERATION) return null;
    const keys = [];
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) keys.push(`${x}:${y}`);
    return keys;
  }
}

function intersects(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x &&
    left.y < right.y + right.height && left.y + left.height > right.y;
}
