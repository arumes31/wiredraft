export class SceneTileIndex {
  constructor(tileSize = 1200) {
    this.tileSize = tileSize;
    this.tiles = new Map();
  }

  clear() { this.tiles.clear(); }

  insert(item) {
    for (const key of this.keys(item)) {
      const bucket = this.tiles.get(key) || [];
      bucket.push(item);
      this.tiles.set(key, bucket);
    }
  }

  query(bounds) {
    const result = new Set();
    for (const key of this.keys(bounds)) {
      for (const item of this.tiles.get(key) || []) result.add(item);
    }
    return [...result].filter((item) => intersects(bounds, item));
  }

  keys(bounds) {
    const left = Math.floor(bounds.x / this.tileSize);
    const top = Math.floor(bounds.y / this.tileSize);
    const right = Math.floor((bounds.x + bounds.width) / this.tileSize);
    const bottom = Math.floor((bounds.y + bounds.height) / this.tileSize);
    const keys = [];
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) keys.push(`${x}:${y}`);
    return keys;
  }
}

function intersects(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x &&
    left.y < right.y + right.height && left.y + left.height > right.y;
}
