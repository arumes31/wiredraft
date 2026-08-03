import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildHTMLDocument, buildPDFDocument } from "./static/js/export.js";

const applicationHTML = readFileSync(new URL("./static/index.html", import.meta.url), "utf8");
const applicationJS = readFileSync(new URL("./static/js/app.js", import.meta.url), "utf8");
const exportJS = readFileSync(new URL("./static/js/export.js", import.meta.url), "utf8");
for (const [id, label] of [["pdf-button", "PDF SHEET"], ["html-button", "HTML REPORT"]]) {
  assert.match(applicationHTML, new RegExp(`id="${id}"[^>]*>[^]*?<b>${label}</b>`), `${label} must be available in the export popup`);
  assert.match(applicationJS, new RegExp(`getElementById\\("${id}"\\)\\.addEventListener`), `${label} must be wired to an export action`);
}
assert.match(applicationJS, /exportModulePromise \|\|= import\("\.\/export\.js"\)/, "heavy export code must be loaded only when first used");
for (const action of ["exportHTML", "exportJSON", "exportPDF", "exportPNG", "exportSVG"]) {
  assert.match(applicationJS, new RegExp(`runLazyExport\\("${action}"`), `${action} must be dispatched through the lazy export module`);
}
assert.match(exportJS, /data-layer="bridge-underpass"[^]*clip-path="url\(#\$\{clipID\}\)"/, "SVG exports must reveal the lower cable inside every crossing bridge");

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
const pdf = buildPDFDocument(jpeg, 1600, 900, "Vienna Core Δ");
const pdfText = Buffer.from(pdf).toString("latin1");
assert.ok(pdfText.startsWith("%PDF-1.4"), "PDF export needs a versioned header");
assert.match(pdfText, /\/MediaBox \[0 0 1190\.55 841\.89\]/, "wide diagrams should use landscape A3");
assert.match(pdfText, /\/Subtype \/Image[^]*\/Filter \/DCTDecode/, "PDF must embed the JPEG as an image object");
assert.match(pdfText, /\/Title <FEFF/, "PDF title metadata should use a Unicode-safe string");
assert.ok(Buffer.from(pdf).includes(Buffer.from(jpeg)), "PDF must contain the complete JPEG payload");
const xrefOffset = Number(pdfText.match(/startxref\n(\d+)\n/)?.[1]);
assert.equal(pdfText.slice(xrefOffset, xrefOffset + 4), "xref", "startxref must point at the cross-reference table");
const xrefEntries = [...pdfText.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
assert.equal(xrefEntries.length, 6, "PDF must index every indirect object");
xrefEntries.forEach((offset, index) => assert.equal(pdfText.slice(offset, offset + 7), `${index + 1} 0 obj`, `xref entry ${index + 1} must point at its object`));

const topology = {
  name: "Core <A> & Edge", racks: [], devices: [], links: [], vlans: [],
  notes: "safe </script><script>alert(1)</script>",
  documentationLinks: [{ targetKind: "topology", label: "Runbook", url: "https://docs.example.test/runbook" }],
};
const engine = {
  worldBounds: () => ({ x: 0, y: 0, width: 800, height: 500 }),
  portCenters: () => new Map(), rackRectangles: () => [], deviceRectangles: () => [],
};
const html = buildHTMLDocument(topology, engine, new Date("2026-08-03T19:30:00.000Z"));
assert.ok(html.startsWith("<!doctype html>"), "HTML export should be a standalone document");
assert.match(html, /<title>Core &lt;A&gt; &amp; Edge · Netdiagram export<\/title>/, "HTML title must be escaped");
assert.match(html, /<svg role="img" aria-label="Core &lt;A&gt; &amp; Edge network topology"/, "HTML must embed the accessible topology SVG");
assert.match(html, /<b>0<\/b>RACKS[^]*<b>0<\/b>DEVICES[^]*<b>0<\/b>CABLES[^]*<b>0<\/b>VLANS/, "HTML should include topology totals");
assert.match(html, /id="netdiagram-topology" type="application\/json"/, "HTML must embed restorable source data as inert JSON");
assert.equal(html.includes("</script><script>alert(1)</script>"), false, "embedded JSON must not break out of its data block");
assert.match(html, /safe \\u003c\/script\\u003e\\u003cscript\\u003ealert\(1\)\\u003c\/script\\u003e/, "HTML must retain escaped source data");
assert.match(html, /ATTACHED DOCUMENTATION[^]*Runbook[^]*https:\/\/docs\.example\.test\/runbook/, "HTML reports must preserve attached documentation links");
assert.equal(/<(?:link|script)\b[^>]+(?:src|href)="https?:/i.test(html), false, "standalone HTML must not depend on remote assets");

console.log("PDF and standalone HTML export checks passed");
