import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./static/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("./static/css/styles.css", import.meta.url), "utf8");
const appJS = readFileSync(new URL("./static/js/app.js", import.meta.url), "utf8");

const dialogs = [...html.matchAll(/<dialog\s+([^>]+)>([\s\S]*?)<\/dialog>/g)];
assert.equal(dialogs.length, 13, "every application dialog should be covered by the modal system");

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
