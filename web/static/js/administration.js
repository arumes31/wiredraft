import { api } from "./api.js";
import { filterUsers, organizationAccess, usersWithAccess } from "./administration-data.js";

const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const protectedUser = (user) => Boolean(user?.protected || user?.bootstrap || user?.isBootstrap);
const protectedOrganization = (organization) => Boolean(organization?.isDefault || organization?.protected);
const userForm = $("user-form");
const organizationForm = $("organization-form");
let users = [];
let organizations = [];
let currentUser = null;
let currentOrganization = null;
let ready = false;
let busy = false;
let dirty = false;

function message(id, text = "") {
  $(id).textContent = text;
  $(id).hidden = !text;
}

function showPage() {
  const organizationView = location.hash === "#organizations";
  $("users-view").hidden = organizationView;
  $("organizations-view").hidden = !organizationView;
  for (const view of ["users", "organizations"]) {
    if ((view === "organizations") === organizationView) $(`${view}-nav`).setAttribute("aria-current", "page");
    else $(`${view}-nav`).removeAttribute("aria-current");
  }
  document.title = `WireDraft · ${organizationView ? "Organizations" : "Users"} · Administration`;
}

async function loadDirectory() {
  const [userDirectory, organizationDirectory] = await Promise.all([api.listUsers(), api.listOrganizations()]);
  users = userDirectory.users || [];
  organizations = organizationDirectory.organizations || [];
  $("users-total").textContent = users.length;
  $("organizations-total").textContent = organizations.length;
  const selected = $("organization-filter").value;
  $("organization-filter").replaceChildren(new Option("All organizations", ""), ...organizations.map(({ id, name }) => new Option(name, id)));
  $("organization-filter").value = organizations.some(({ id }) => id === selected) ? selected : "";
  renderUsers();
  renderOrganizations();
}

async function initialize() {
  $("retry-load").hidden = true;
  message("page-error");
  message("page-status", "Loading administration…");
  try {
    const session = await api.authStatus();
    if (!session.authenticated) { location.replace("/login"); return; }
    if (session.role !== "admin") {
      message("page-status");
      message("page-error", "Administrator access required. Return to the workspace or sign in with an administrator account.");
      return;
    }
    api.setCSRFToken(session.csrfToken);
    $("session-name").textContent = session.username;
    await loadDirectory();
    ready = true;
    $("administration-content").hidden = false;
    message("page-status");
    showPage();
  } catch (error) {
    message("page-status");
    message("page-error", `Could not load administration. ${error.message}`);
    $("retry-load").hidden = false;
  }
}

function renderUsers() {
  const filters = Object.fromEntries(new FormData($("user-filters")));
  const visible = filterUsers(users, filters);
  $("user-results").textContent = `${visible.length} of ${users.length} users${filters.organization ? " · includes administrators and global access" : ""}`;
  $("users-empty").hidden = visible.length > 0;
  $("user-rows").innerHTML = visible.map((user) => {
    const id = escapeHTML(user.id);
    const entra = user.authSource === "entra";
    const providerState = entra ? (user.externalLinked ? "Linked" : "Awaiting first sign-in") : (user.totpConfigured ? "TOTP configured" : "TOTP setup required");
    return `<tr><td class="identity"><button class="user-name" type="button" data-user="${id}">${escapeHTML(user.username)}</button>${user.externalLogin ? `<small>${escapeHTML(user.externalLogin)}</small>` : ""}${protectedUser(user) ? '<small class="protected-label">Protected administrator</small>' : ""}</td><td>${entra ? "Microsoft Entra" : "Local"}<small>${providerState}</small></td><td>${user.role === "admin" ? "Administrator" : "Operator"}</td><td class="access-cell">${escapeHTML(organizationAccess(user, organizations))}</td><td><span class="status${user.disabled ? " disabled" : ""}">${user.disabled ? "Disabled" : "Active"}</span></td><td><button type="button" class="row-action" data-user="${id}" aria-label="${protectedUser(user) ? "View" : "Manage"} ${escapeHTML(user.username)}">${protectedUser(user) ? "View" : "Manage"}</button></td></tr>`;
  }).join("");
}

function renderOrganizations() {
  const query = $("organization-search").value.trim().toLocaleLowerCase();
  const visible = organizations.filter(({ name }) => name.toLocaleLowerCase().includes(query));
  $("organization-results").textContent = `${visible.length} of ${organizations.length} organizations`;
  $("organizations-empty").hidden = visible.length > 0;
  $("organization-rows").innerHTML = visible.map((organization) => {
    const id = escapeHTML(organization.id);
    return `<tr><td class="identity"><button type="button" class="user-name" data-organization="${id}">${escapeHTML(organization.name)}</button></td><td>${Number(organization.mapCount || 0)}</td><td><button type="button" class="user-name" data-organization-users="${id}" aria-label="View users with access to ${escapeHTML(organization.name)}">${usersWithAccess(users, organization.id).length} users →</button></td><td>${organization.isDefault ? '<span class="protected-label">Protected default</span>' : organization.protected ? '<span class="protected-label">Guest workspace</span>' : "—"}</td><td><button type="button" class="row-action" data-organization="${id}" aria-label="Manage ${escapeHTML(organization.name)}">Manage</button></td></tr>`;
  }).join("");
}

function viewOrganizationUsers(id) {
  $("user-filters").reset();
  $("organization-filter").value = id;
  renderUsers();
  location.hash = "users";
  showPage();
  $("users-title").focus();
}

function openUser(user = null) {
  currentUser = user;
  userForm.reset();
  dirty = false;
  const editing = Boolean(user);
  const locked = protectedUser(user);
  $("user-fields").disabled = locked;
  userForm.elements.username.value = user?.username || "";
  userForm.elements.username.readOnly = editing;
  userForm.elements.authSource.value = user?.authSource || "local";
  userForm.elements.authSource.disabled = editing;
  userForm.elements.externalLogin.value = user?.externalLogin || "";
  userForm.elements.externalLogin.readOnly = editing;
  userForm.elements.role.value = user?.role || "user";
  userForm.elements.allOrganizations.checked = Boolean(user?.allOrganizations || user?.role === "admin");
  $("user-editor-title").textContent = editing ? user.username : "Add user";
  $("save-user").textContent = editing ? "Save access" : "Create user";
  $("save-user").hidden = locked;
  $("protected-user-note").hidden = !locked;
  $("session-warning").hidden = !editing || locked;
  $("user-security-actions").hidden = !editing || locked;
  $("toggle-user").textContent = user?.disabled ? "Enable account" : "Disable account";
  $("reset-identity").hidden = user?.authSource !== "entra" || !user?.externalLinked;
  const assigned = new Set(user?.organizationIds || []);
  $("organization-picker").replaceChildren(...[...organizations].sort((a, b) => Number(assigned.has(b.id)) - Number(assigned.has(a.id)) || a.name.localeCompare(b.name)).map((organization) => {
    const label = document.createElement("label");
    label.className = "check-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "organizationIds";
    checkbox.value = organization.id;
    checkbox.checked = assigned.has(organization.id);
    const text = document.createElement("span");
    text.textContent = `${organization.name}${organization.isDefault ? " · Default" : ""}`;
    label.append(checkbox, text);
    return label;
  }));
  message("user-error");
  refreshAuthSource();
  refreshAccess();
  filterGrants();
  $("user-editor").showModal();
}

function refreshAuthSource() {
  const entra = userForm.elements.authSource.value === "entra";
  const editing = Boolean(currentUser);
  $("password-field").hidden = entra || editing;
  $("entra-field").hidden = !entra;
  userForm.elements.password.required = !entra && !editing;
  userForm.elements.password.disabled = entra || editing;
  if (entra || editing) userForm.elements.password.value = "";
  userForm.elements.externalLogin.required = entra;
  userForm.elements.externalLogin.disabled = !entra;
  $("sign-in-note").textContent = entra
    ? (currentUser?.externalLinked ? "Microsoft identity linked. MFA and sign-in policies are managed in Entra." : "The approved Microsoft identity is linked at first sign-in. MFA and sign-in policies are managed in Entra.")
    : (currentUser?.totpConfigured ? "TOTP is configured for this local account." : "At first sign-in, the user sets up TOTP and receives one-use recovery codes.");
}

function refreshAccess() {
  const admin = userForm.elements.role.value === "admin";
  if (admin) userForm.elements.allOrganizations.checked = true;
  userForm.elements.allOrganizations.disabled = admin;
  const globalAccess = admin || userForm.elements.allOrganizations.checked;
  $("organization-grants").hidden = globalAccess;
  $("organization-grants").disabled = globalAccess;
  const selected = [...userForm.querySelectorAll('input[name="organizationIds"]:checked')].length;
  $("access-summary").textContent = admin ? "Administrators manage users and organizations and can access all maps."
    : globalAccess ? "Access to maps in all organizations, without user or organization management rights."
      : `${selected} organization${selected === 1 ? "" : "s"} selected. Operators can access maps in their assigned organizations.`;
}

function filterGrants() {
  const query = $("grant-search").value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const label of $("organization-picker").children) {
    label.hidden = !label.textContent.toLocaleLowerCase().includes(query);
    if (!label.hidden) visible++;
  }
  $("grants-empty").hidden = visible > 0;
}

function closeEditor(id) {
  if (busy || (dirty && !window.confirm("Discard unsaved changes?"))) return false;
  dirty = false;
  $(id).close();
  return true;
}

// A successful mutation is kept successful even if refreshing the directory fails.
async function mutation(editorID, errorID, action, success) {
  if (busy) return;
  busy = true;
  message(errorID);
  const controls = [...$(editorID).querySelectorAll("button, input, select, fieldset")];
  const disabled = controls.map((control) => control.disabled);
  controls.forEach((control) => { control.disabled = true; });
  try {
    await action();
    dirty = false;
    $(editorID).close();
    message("page-error");
    message("page-status", success);
    try { await loadDirectory(); } catch (error) {
      message("page-error", `Change saved, but the directory could not be refreshed. ${error.message}`);
      $("administration-content").hidden = true;
      ready = false;
      $("retry-load").hidden = false;
    }
  } catch (error) {
    message(errorID, error.message);
  } finally {
    controls.forEach((control, index) => { control.disabled = disabled[index]; });
    busy = false;
  }
}

function saveUser(event) {
  event.preventDefault();
  if (protectedUser(currentUser)) return;
  const data = new FormData(userForm);
  const role = String(data.get("role"));
  const allOrganizations = role === "admin" || data.get("allOrganizations") === "on";
  const organizationIds = allOrganizations ? [] : data.getAll("organizationIds");
  if (!allOrganizations && !organizationIds.length) { message("user-error", "Select at least one organization or allow access to all organizations."); return; }
  const access = { role, allOrganizations, organizationIds };
  const user = currentUser;
  const authSource = String(data.get("authSource") || "local");
  const input = user ? { ...access, disabled: Boolean(user.disabled) } : {
    username: String(data.get("username")).trim(), authSource, ...access,
    ...(authSource === "entra" ? { externalLogin: String(data.get("externalLogin")).trim() } : { password: String(data.get("password")) }),
  };
  return mutation("user-editor", "user-error", () => user ? api.updateUser(user.id, input) : api.createUser(input), user ? `Access updated for ${user.username}. Active sessions were revoked.` : `User ${input.username} created.`);
}

function changeUserSecurity(resetIdentity = false) {
  const user = currentUser;
  if (!user || protectedUser(user)) return;
  if (dirty) { message("user-error", "Save or discard your access changes before changing sign-in settings."); return; }
  const disabled = resetIdentity ? Boolean(user.disabled) : !user.disabled;
  const question = resetIdentity ? `Reset the Microsoft link for ${user.username}? They must link again at next sign-in.`
    : `${disabled ? "Disable" : "Enable"} ${user.username}?${disabled ? " Their active sessions will be revoked." : ""}`;
  if (!window.confirm(question)) return;
  return mutation("user-editor", "user-error", () => api.updateUser(user.id, {
    role: user.role, allOrganizations: Boolean(user.allOrganizations), organizationIds: user.organizationIds || [], disabled, resetExternalIdentity: resetIdentity,
  }), resetIdentity ? "Microsoft identity link reset." : `Account ${disabled ? "disabled" : "enabled"}.`);
}

function openOrganization(organization = null) {
  currentOrganization = organization;
  organizationForm.reset();
  dirty = false;
  const locked = protectedOrganization(organization);
  organizationForm.elements.name.value = organization?.name || "";
  organizationForm.elements.name.readOnly = locked;
  $("organization-editor-title").textContent = organization ? organization.name : "Add organization";
  $("save-organization").textContent = organization ? "Save name" : "Create organization";
  $("save-organization").hidden = locked;
  $("organization-details").hidden = !organization;
  message("organization-error");
  message("organization-protection", locked ? (organization.isDefault ? "The default organization is protected and cannot be renamed or deleted." : "The active guest workspace is protected and cannot be renamed or deleted.") : "");
  if (organization) {
    const maps = Number(organization.mapCount || 0);
    $("organization-detail-counts").textContent = `${maps} maps · ${usersWithAccess(users, organization.id).length} users with access, including global access and disabled accounts.`;
    $("delete-organization").disabled = locked || maps > 0;
    $("delete-organization-note").textContent = locked ? "Protected organizations cannot be deleted." : maps ? "Move or delete all maps before deleting this organization." : "Deleting this organization also removes its user assignments. This cannot be undone.";
  }
  $("organization-editor").showModal();
}

function saveOrganization(event) {
  event.preventDefault();
  if (protectedOrganization(currentOrganization)) return;
  const name = organizationForm.elements.name.value.trim();
  if (!name) { message("organization-error", "Enter an organization name."); return; }
  const organization = currentOrganization;
  return mutation("organization-editor", "organization-error", () => organization ? api.updateOrganization(organization.id, { name }) : api.createOrganization({ name }), organization ? `Organization renamed to ${name}.` : `Organization ${name} created.`);
}

function deleteOrganization() {
  const organization = currentOrganization;
  if (!organization || protectedOrganization(organization) || Number(organization.mapCount) > 0) return;
  if (dirty) { message("organization-error", "Save or discard the name change before deleting this organization."); return; }
  if (!window.confirm(`Delete ${organization.name}? Its user assignments will be removed. This cannot be undone.`)) return;
  return mutation("organization-editor", "organization-error", () => api.deleteOrganization(organization.id), `Organization ${organization.name} deleted.`);
}

$("user-filters").addEventListener("submit", (event) => event.preventDefault());
$("user-filters").addEventListener("input", renderUsers);
$("clear-filters").addEventListener("click", () => { $("user-filters").reset(); renderUsers(); });
$("organization-search").addEventListener("input", renderOrganizations);
$("add-user").addEventListener("click", () => openUser());
$("add-organization").addEventListener("click", () => openOrganization());
$("user-rows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-user]");
  const user = users.find(({ id }) => id === button?.dataset.user);
  if (user) openUser(user);
});
$("organization-rows").addEventListener("click", (event) => {
  const access = event.target.closest("[data-organization-users]");
  if (access) { viewOrganizationUsers(access.dataset.organizationUsers); return; }
  const button = event.target.closest("[data-organization]");
  const organization = organizations.find(({ id }) => id === button?.dataset.organization);
  if (organization) openOrganization(organization);
});
userForm.addEventListener("submit", saveUser);
userForm.elements.authSource.addEventListener("change", refreshAuthSource);
userForm.elements.role.addEventListener("change", refreshAccess);
userForm.elements.allOrganizations.addEventListener("change", refreshAccess);
$("organization-picker").addEventListener("change", refreshAccess);
$("grant-search").addEventListener("input", filterGrants);
$("grant-search").addEventListener("keydown", (event) => { if (event.key === "Enter") event.preventDefault(); });
$("toggle-user").addEventListener("click", () => changeUserSecurity());
$("reset-identity").addEventListener("click", () => changeUserSecurity(true));
organizationForm.addEventListener("submit", saveOrganization);
$("delete-organization").addEventListener("click", deleteOrganization);
$("view-organization-users").addEventListener("click", () => { if (closeEditor("organization-editor")) viewOrganizationUsers(currentOrganization.id); });
document.querySelectorAll("[data-dismiss]").forEach((button) => button.addEventListener("click", () => closeEditor(button.dataset.dismiss)));
for (const id of ["user-editor", "organization-editor"]) {
  $(id).addEventListener("cancel", (event) => { event.preventDefault(); closeEditor(id); });
  $(id).addEventListener("input", (event) => { if (event.target.id !== "grant-search") dirty = true; });
  $(id).addEventListener("close", () => { if (id === "user-editor") userForm.elements.password.value = ""; });
}
window.addEventListener("beforeunload", (event) => { if (dirty || (busy && document.querySelector("dialog[open]"))) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("hashchange", () => { if (ready) showPage(); });
document.querySelector(".skip-link").addEventListener("click", (event) => { event.preventDefault(); $("main").focus(); });
$("retry-load").addEventListener("click", initialize);
showPage();
initialize();
