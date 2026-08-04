import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginHTML = await readFile(new URL("./static/login.html", import.meta.url), "utf8");
const loginJS = await readFile(new URL("./static/js/login.js", import.meta.url), "utf8");
const loginCSS = await readFile(new URL("./static/css/login.css", import.meta.url), "utf8");
const indexHTML = await readFile(new URL("./static/index.html", import.meta.url), "utf8");
const apiJS = await readFile(new URL("./static/js/api.js", import.meta.url), "utf8");

test("login page contains password, guest, totp enrollment, and recovery states", () => {
  for (const id of [
    "login-form", "guest-button", "setup-step", "totp-qr", "totp-secret", "totp-form",
    "recovery-form", "recovery-codes-step", "recovery-code-list",
  ]) {
    assert.match(loginHTML, new RegExp(`id="${id}"`));
  }
  assert.match(loginJS, /\/api\/v1\/auth\/login/);
  assert.match(loginJS, /\/api\/v1\/auth\/setup/);
  assert.match(loginJS, /\/api\/v1\/auth\/recovery/);
  assert.match(loginJS, /recoveryCodes\.join/);
  assert.match(loginHTML, /<title>WireDraft · Secure Access<\/title>/);
  assert.match(loginHTML, /<strong>WIREDRAFT<\/strong>/);
  assert.doesNotMatch(loginHTML, /Netdiagram/i);
});

test("login backdrop is decorative, noninteractive, and isolated from authentication", () => {
  assert.match(loginHTML, /<canvas id="topology-backdrop" class="topology-backdrop" aria-hidden="true"><\/canvas>/);
  assert.match(loginHTML, /PROCEDURAL TOPOLOGY ASSEMBLY/);
  assert.match(loginJS, /startLoginBackground\(document\.getElementById\("topology-backdrop"\)\)/);
  assert.match(loginCSS, /\.topology-backdrop[^}]*pointer-events: none/);
});

test("workspace exposes admin account management and csrf-aware api calls", () => {
  for (const id of ["account-menu", "manage-users-button", "account-dialog", "account-form", "account-organizations"]) {
    assert.match(indexHTML, new RegExp(`id="${id}"`));
  }
  assert.match(apiJS, /X-CSRF-Token/);
  assert.match(apiJS, /\/api\/v1\/admin\/users/);
  assert.match(apiJS, /\/api\/v1\/auth\/logout/);
  assert.match(indexHTML, /<title>WireDraft · Rack Operations Bench<\/title>/);
  assert.match(indexHTML, /aria-label="WireDraft"/);
  assert.match(indexHTML, /<summary aria-label="Saved\. Autosave on\. Open autosave settings">/);
  assert.doesNotMatch(indexHTML, /Netdiagram/i);
});
