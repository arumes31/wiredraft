import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./static/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("./static/css/styles.css", import.meta.url), "utf8");
const appJS = readFileSync(new URL("./static/js/app.js", import.meta.url), "utf8");

const dialogs = [...html.matchAll(/<dialog\s+([^>]+)>([\s\S]*?)<\/dialog>/g)];
assert.equal(dialogs.length, 14, "every application dialog should be covered by the modal system");

for (const [, attributes, body] of dialogs) {
  const id = attributes.match(/\bid="([^"]+)"/)?.[1];
  const labelledBy = attributes.match(/\baria-labelledby="([^"]+)"/)?.[1];
  assert.ok(id, "dialog must have an id");
  assert.match(attributes, /\bclass="[^"]*\bpanel-dialog\b/, `${id} must use panel-dialog`);
  assert.ok(labelledBy, `${id} must reference its visible title`);
  assert.match(body, new RegExp(`\\bid="${labelledBy}"`), `${id} title must exist inside the dialog`);
  assert.match(body, new RegExp(`class="dialog-close"[^>]+data-close="${id}"[^>]+aria-label="[^"]+"`), `${id} close control must be labelled and target the dialog`);
}

assert.match(html, /class="export-popover"\s+role="menu"/, "export actions should use the shared popup surface");
assert.match(html, /<button id="resources-button">RESOURCES<\/button>/,
  "documentation and sharing should be presented as map resources, not as the comment workflow");
assert.match(html, /<button id="patch-panel-map-button">PANEL MAP<\/button>/,
  "the toolbar should use the user-facing Panel Map name");
assert.doesNotMatch(appJS, /patch-panel-map-button"\)\.disabled\s*=/,
  "Panel Map must remain clickable so unavailable-state feedback can be displayed");
assert.match(appJS, /PANEL MAP UNAVAILABLE · \$\{availability\.message\}/,
  "Panel Map must display explicit feedback when fewer than two panels exist");
const resourcesDialog = dialogs.find(([, attributes]) => /\bid="resources-dialog"/.test(attributes))?.[2] || "";
assert.doesNotMatch(resourcesDialog, /COMMENT|comment-form|comments-list/,
  "plan comments must not be owned by the resources/collaboration modal");
assert.match(appJS, /<h3>PLAN COMMENTS<\/h3>/, "selected objects need a first-class plan comment inspector");
assert.match(appJS, /class="inspector-comment-form"[\s\S]*?ADD TO PLAN/,
  "the plan comment composer must be directly available in the inspector");
assert.match(appJS, /api\.createComment\(state\.topology\.id, \{\s*anchor,/,
  "inspector comments must persist through the topology comment API");
assert.match(html, /<details id="export-menu" class="export-menu">\s*<summary aria-haspopup="menu">/, "export popup needs an addressable menu trigger");
assert.match(css, /\.export-popover \{[^}]*top: calc\(100% \+ 10px\);[^}]*bottom: auto;[^}]*transform-origin: top right;/,
  "export popup must open downward from the toolbar trigger");
assert.match(appJS, /async function runExportAction\(action\) \{\s*await action\(\);\s*closeExportMenu\(\);\s*\}/,
  "successful exports must close the popup after their action completes");
for (const id of ["png-button", "svg-button", "pdf-button", "html-button", "configuration-button", "json-button"]) {
  assert.match(appJS, new RegExp(`getElementById\\("${id}"\\)\\.addEventListener\\("click", \\(\\) => runLazyExport`),
    `${id} must use the lazy auto-closing export action`);
}
assert.match(html, /id="toast"\s+class="toast-queue"\s+aria-live="polite"/, "the queued toast region must remain polite");
assert.match(html, /name="rearChannelGroupSize"[^>]*>\s*<option value="all" selected>ALL SELECTED RUNS<\/option>[\s\S]*?<option value="24">24 STRANDS<\/option>/,
  "Panel Map must expose configurable strands-per-channel tube grouping");
assert.doesNotMatch(css, /@media \(max-width: 1600px\)[^{]*\{[^}]*#patch-panel-map-button[^}]*display:\s*none/,
  "responsive workbench widths must keep the rear-map tube configuration reachable");

for (const selector of [
  ".panel-dialog[open]",
  ".panel-dialog::backdrop",
  ".export-popover",
  "@media (max-width: 640px)",
  "@media (prefers-reduced-motion: reduce)",
]) {
  assert.ok(css.includes(selector), `modal stylesheet must include ${selector}`);
}

console.log("modal and popup UI contract checks passed");
