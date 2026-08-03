import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { obstacleAwareCableRoute, pointOnRoute } from "./static/js/cabling.js";

const fixtures = JSON.parse(readFileSync(new URL("./testdata/cable-routes.json", import.meta.url), "utf8"));
for (const fixture of fixtures) {
  const route = obstacleAwareCableRoute(fixture.source, fixture.target, fixture.options);
  const snapshot = Array.from({ length: 11 }, (_, index) => {
    const point = pointOnRoute(route, index / 10);
    return [Number(point.x.toFixed(2)), Number(point.y.toFixed(2))];
  });
  assert.deepEqual(snapshot, fixture.snapshot, `${fixture.name} routing snapshot changed`);
  assert.deepEqual(obstacleAwareCableRoute(fixture.source, fixture.target, fixture.options), route, `${fixture.name} is not deterministic`);
}

console.log("fixture-driven cable routing snapshots passed");
