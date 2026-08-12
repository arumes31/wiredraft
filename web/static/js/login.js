import { startLoginBackground } from "./login-background.js";

startLoginBackground(document.getElementById("topology-backdrop"));

const elements = Object.fromEntries([
  "login-form", "alternative-login-divider", "guest-button", "entra-button", "setup-step", "setup-form", "totp-step", "totp-form",
  "recovery-step", "recovery-form", "recovery-codes-step", "totp-qr", "totp-secret",
  "copy-secret-button", "show-recovery-button", "back-to-totp-button", "recovery-code-list",
  "copy-recovery-button", "download-recovery-button", "continue-button", "access-error",
  "restart-login-button", "access-kicker", "access-title", "access-description",
].map((id) => [id, document.getElementById(id)]));

let challenge = "";
let recoveryCodes = [];

initialize().catch(showError);

async function initialize() {
  const status = await request("/api/v1/auth/status");
  if (status.authenticated) {
    window.location.replace("/");
    return;
  }
  elements["guest-button"].hidden = !status.guestEnabled;
  elements["entra-button"].hidden = !status.entraEnabled;
  elements["alternative-login-divider"].hidden = !status.guestEnabled && !status.entraEnabled;
  bindControls();
  const entraError = new URLSearchParams(window.location.search).get("entra_error");
  if (entraError) {
    showError(new Error(entraError === "unavailable"
      ? "Microsoft sign-in is temporarily unavailable. Local login remains available."
      : "Microsoft sign-in was not accepted or this account has not been approved."));
    history.replaceState({}, "", "/login");
  }
}

function bindControls() {
  elements["login-form"].addEventListener("submit", safely(startLogin));
  elements["guest-button"].addEventListener("click", safely(loginGuest));
  elements["setup-form"].addEventListener("submit", safely(completeSetup));
  elements["totp-form"].addEventListener("submit", safely(completeTOTP));
  elements["recovery-form"].addEventListener("submit", safely(completeRecovery));
  elements["show-recovery-button"].addEventListener("click", () => showStep("recovery-step"));
  elements["back-to-totp-button"].addEventListener("click", () => showStep("totp-step"));
  elements["copy-secret-button"].addEventListener("click", () => copyText(elements["totp-secret"].textContent));
  elements["copy-recovery-button"].addEventListener("click", () => copyText(recoveryCodes.join("\n")));
  elements["download-recovery-button"].addEventListener("click", downloadRecoveryCodes);
  elements["continue-button"].addEventListener("click", () => window.location.assign("/"));
  elements["restart-login-button"].addEventListener("click", resetLogin);
}

function safely(action) {
  return (event) => void action(event).catch(showError);
}

async function startLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearError();
  const data = new FormData(form);
  setBusy(form, true);
  try {
    const result = await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: String(data.get("username")), password: String(data.get("password")) }),
    });
    challenge = result.challenge;
    form.elements.password.value = "";
    if (result.next === "setup") {
      elements["totp-qr"].src = result.enrollment.qrCodeDataUrl;
      elements["totp-secret"].textContent = result.enrollment.manualCode;
      setConsoleHeading("SECURE ENROLLMENT", "PAIR SECOND FACTOR", "Authenticator setup is mandatory before this account can open any map.");
      showStep("setup-step");
      elements["setup-form"].elements.code.focus();
      return;
    }
    setConsoleHeading("SECOND FACTOR", "VERIFY OPERATOR", "Password accepted. Complete the authenticator check to open a session.");
    showStep("totp-step");
    elements["totp-form"].elements.code.focus();
  } finally {
    setBusy(form, false);
  }
}

async function loginGuest() {
  clearError();
  setBusy(elements["guest-button"], true);
  try {
    await request("/api/v1/auth/guest", { method: "POST", body: "{}" });
    window.location.assign("/");
  } finally {
    setBusy(elements["guest-button"], false);
  }
}

async function completeSetup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearError();
  setBusy(form, true);
  try {
    const result = await verifyChallenge("/api/v1/auth/setup", form.elements.code.value);
    recoveryCodes = result.recoveryCodes || [];
    elements["recovery-code-list"].replaceChildren(...recoveryCodes.map((code) => {
      const item = document.createElement("li");
      item.textContent = code;
      return item;
    }));
    setConsoleHeading("ENROLLMENT COMPLETE", "SECURE THE FALLBACK", "Store the one-use recovery codes before continuing.");
    showStep("recovery-codes-step");
  } finally {
    setBusy(form, false);
  }
}

async function completeTOTP(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearError();
  setBusy(form, true);
  try {
    await verifyChallenge("/api/v1/auth/totp", form.elements.code.value);
    window.location.assign("/");
  } finally {
    setBusy(form, false);
  }
}

async function completeRecovery(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearError();
  setBusy(form, true);
  try {
    await verifyChallenge("/api/v1/auth/recovery", form.elements.code.value);
    window.location.assign("/");
  } finally {
    setBusy(form, false);
  }
}

function verifyChallenge(path, code) {
  return request(path, { method: "POST", body: JSON.stringify({ challenge, code: String(code) }) });
}

function showStep(id) {
  for (const step of ["login-form", "setup-step", "totp-step", "recovery-step", "recovery-codes-step"]) {
    elements[step].hidden = step !== id;
  }
  elements["restart-login-button"].hidden = id === "login-form" || id === "recovery-codes-step";
}

function resetLogin() {
  challenge = "";
  recoveryCodes = [];
  elements["login-form"].reset();
  clearError();
  setConsoleHeading("OPERATOR AUTHENTICATION", "OPEN CONTROL SESSION", "Use your administrator or organization account.");
  showStep("login-form");
  elements["login-form"].elements.username.focus();
}

function setConsoleHeading(kicker, title, description) {
  elements["access-kicker"].textContent = kicker;
  elements["access-title"].textContent = title;
  elements["access-description"].textContent = description;
}

function setBusy(target, busy) {
  if (target instanceof HTMLFormElement) {
    for (const control of target.elements) control.disabled = busy;
  } else {
    target.disabled = busy;
  }
  target.classList.toggle("is-busy", busy);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `Request failed (${response.status})`);
    error.status = response.status;
    showError(error);
    throw error;
  }
  return body;
}

function showError(error) {
  const message = error?.status === 401
    ? "Credentials or verification code are invalid. Check the entry and try again."
    : error?.message || "The identity gateway is unavailable.";
  elements["access-error"].textContent = message;
  elements["access-error"].hidden = false;
}

function clearError() {
  elements["access-error"].hidden = true;
  elements["access-error"].textContent = "";
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(String(value || ""));
  } catch {
    showError(new Error("Clipboard access is unavailable. Select and copy the value manually."));
  }
}

function downloadRecoveryCodes() {
  const blob = new Blob([
    `WIREDRAFT RECOVERY CODES\nGenerated: ${new Date().toISOString()}\n\n${recoveryCodes.join("\n")}\n`,
  ], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "wiredraft-recovery-codes.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}
