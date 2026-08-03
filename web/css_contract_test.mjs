import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./static/css/styles.css", import.meta.url), "utf8");
const snapshot = JSON.parse(readFileSync(new URL("./testdata/css-contract.json", import.meta.url), "utf8"));
const root = css.match(/:root\s*{(?<body>[\s\S]*?)}/)?.groups.body || "";
const variables = Object.fromEntries([...root.matchAll(/--(?<name>[a-z0-9-]+):\s*(?<value>[^;]+);/gi)]
  .map(({ groups }) => [`--${groups.name}`, groups.value.trim()]));

assert.deepEqual(Object.fromEntries(snapshot.variables.map((name) => [name, variables[name]])), snapshot.values,
  "visual design tokens changed; review the CSS contract snapshot deliberately");
for (const selector of snapshot.requiredSelectors) {
  assert.match(css, new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[{,]`), `required visual selector ${selector} is missing`);
}
for (const token of snapshot.minimumContrastTokens) {
  assert.match(variables[token] || "", /^#[0-9a-f]{6}$/i, `${token} must remain an opaque six-digit color`);
}

console.log("CSS design-token and selector contract passed");
