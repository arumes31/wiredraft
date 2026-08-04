import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./static/js/app.js", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("./static/js/api.js", import.meta.url), "utf8");

assert.equal((appSource.match(/id="reverse-link-direction"/g) || []).length, 2,
  "front and rear Link Inspectors must both expose the direction control");
assert.match(appSource, /api\.setLinkDirection\(state\.topology\.id, link\.id, link\.targetPortId\)/,
  "the direction control must make the current target the desired source");
assert.match(apiSource, /links\/\$\{encodeURIComponent\(linkID\)\}\/direction/,
  "the client must persist direction through the dedicated idempotent endpoint");

console.log("link direction inspector checks passed");
