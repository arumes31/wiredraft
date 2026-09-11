import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginHTML = await readFile(new URL("./static/login.html", import.meta.url), "utf8");
const loginJS = await readFile(new URL("./static/js/login.js", import.meta.url), "utf8");
const loginCSS = await readFile(new URL("./static/css/login.css", import.meta.url), "utf8");
const indexHTML = await readFile(new URL("./static/index.html", import.meta.url), "utf8");
const appJS = await readFile(new URL("./static/js/app.js", import.meta.url), "utf8");
const stylesCSS = await readFile(new URL("./static/css/styles.css", import.meta.url), "utf8");
const apiJS = await readFile(new URL("./static/js/api.js", import.meta.url), "utf8");
const adminHTML = await readFile(new URL("./static/admin.html", import.meta.url), "utf8");
const adminJS = await readFile(new URL("./static/js/administration.js", import.meta.url), "utf8");

test("login page contains password, guest, totp enrollment, and recovery states", () => {
  for (const id of [
    "login-form", "alternative-login-divider", "guest-button", "entra-button", "setup-step", "totp-qr", "totp-secret", "totp-form",
    "recovery-form", "recovery-codes-step", "recovery-code-list",
  ]) {
    assert.match(loginHTML, new RegExp(`id="${id}"`));
  }
  assert.match(loginJS, /\/api\/v1\/auth\/login/);
  assert.match(loginJS, /\/api\/v1\/auth\/setup/);
  assert.match(loginJS, /\/api\/v1\/auth\/recovery/);
  assert.match(loginHTML, /\/api\/v1\/auth\/entra\/start/);
  assert.match(loginJS, /status\.entraEnabled/);
  assert.match(loginJS, /!status\.guestEnabled && !status\.entraEnabled/);
  assert.match(loginJS, /recoveryCodes\.join/);
  assert.match(loginHTML, /<title>WireDraft · Secure Access<\/title>/);
  assert.match(loginHTML, /<strong>WIREDRAFT<\/strong>/);
  assert.match(loginHTML, /rel="icon" href="\/favicon\.svg"/);
  assert.match(indexHTML, /rel="icon" href="\/favicon\.svg"/);
});

test("login backdrop is decorative, noninteractive, and isolated from authentication", () => {
  assert.match(loginHTML, /<canvas id="topology-backdrop" class="topology-backdrop" aria-hidden="true"><\/canvas>/);
  assert.match(loginHTML, /PROCEDURAL TOPOLOGY ASSEMBLY/);
  assert.match(loginJS, /startLoginBackground\(document\.getElementById\("topology-backdrop"\)\)/);
  assert.match(loginCSS, /\.topology-backdrop[^}]*pointer-events: none/);
});

test("workspace exposes admin account management and csrf-aware api calls", () => {
  for (const id of [
    "account-menu", "organization-scope-toggle", "organization-scope-list", "manage-users-button",
    "manage-organizations-button",
  ]) {
    assert.match(indexHTML, new RegExp(`id="${id}"`));
  }
  assert.match(apiJS, /X-CSRF-Token/);
  assert.match(apiJS, /\/api\/v1\/admin\/users/);
  assert.match(apiJS, /\/api\/v1\/admin\/organizations/);
  assert.match(apiJS, /\/api\/v1\/auth\/logout/);
  assert.match(adminHTML, /name="authSource"/);
  assert.match(adminHTML, /name="externalLogin"/);
  assert.match(adminHTML, /id="organization-picker"/);
  assert.match(adminJS, /password: String\(data\.get\("password"\)\)/);
  assert.match(appJS, /openAdministration\("users"\)/);
  assert.match(appJS, /if \(autosave\.isDirty\) await saveNow\(\)/);
  assert.doesNotMatch(indexHTML, /id="account-dialog"|id="organization-dialog"/);
  assert.match(appJS, /ORGANIZATION_SCOPE_STORAGE_KEY/);
  assert.match(appJS, /topologiesForOrganizationScope/);
  assert.match(stylesCSS, /\.organization-scope-list/);
  assert.doesNotMatch(stylesCSS, /\.account-user-actions button:last-child/);
  assert.match(indexHTML, /<title>WireDraft · Rack Operations Bench<\/title>/);
  assert.match(indexHTML, /aria-label="WireDraft"/);
  assert.match(indexHTML, /<summary aria-label="Saved\. Autosave on\. Open autosave settings">/);
});
