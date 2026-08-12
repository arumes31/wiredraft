import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_ORGANIZATIONS_SCOPE,
  ORGANIZATION_SCOPE_STORAGE_KEY,
  organizationForNewTopology,
  organizationScopeOptions,
  resolveOrganizationScope,
  topologiesForOrganizationScope,
} from "./static/js/organizations.js";

const organizations = [
  { id: "default-id", name: "Default", isDefault: true },
  { id: "branch-id", name: "Branch", isDefault: false },
];

test("organization scope uses the durable WireDraft storage key", () => {
  assert.equal(ORGANIZATION_SCOPE_STORAGE_KEY, "wiredraft.organization-scope.v1");
});

test("administrators and global users can select all organizations", () => {
  for (const principal of [
    { role: "admin", availableOrganizations: organizations },
    { role: "user", allOrganizations: true, availableOrganizations: organizations },
  ]) {
    assert.deepEqual(organizationScopeOptions(principal).map(({ id }) => id), ["all", "default-id", "branch-id"]);
  }
});

test("scoped users see only their assigned organizations", () => {
  const principal = {
    role: "user", organizationIds: ["branch-id"], availableOrganizations: organizations,
  };
  assert.deepEqual(organizationScopeOptions(principal).map(({ id }) => id), ["branch-id"]);
  assert.deepEqual(organizationScopeOptions({ role: "user", organizationIds: [], availableOrganizations: organizations }), []);
  assert.deepEqual(organizationScopeOptions({
    role: "guest", organizationIds: ["guest-id"],
    availableOrganizations: [
      { id: "guest-id", name: "Guest" },
      { id: "guest-id", name: "Duplicate" },
      { id: "private-id", name: "Private" },
      { name: "Missing ID" },
    ],
  }).map(({ id }) => id), ["guest-id"]);
});

test("missing and stale selections fall back to the protected Default organization", () => {
  const principal = { role: "admin", availableOrganizations: organizations };
  assert.equal(resolveOrganizationScope(principal), "default-id");
  assert.equal(resolveOrganizationScope(principal, "deleted-id"), "default-id");
  assert.equal(resolveOrganizationScope(principal, "branch-id"), "branch-id");
  assert.equal(resolveOrganizationScope(principal, ALL_ORGANIZATIONS_SCOPE), ALL_ORGANIZATIONS_SCOPE);
  assert.equal(resolveOrganizationScope({ role: "user", organizationIds: [], availableOrganizations: [] }), "");
});

test("scope filtering never widens access", () => {
  const maps = [
    { id: "one", organizationId: "default-id" },
    { id: "two", organizationId: "branch-id" },
  ];
  assert.deepEqual(topologiesForOrganizationScope(maps, "branch-id").map(({ id }) => id), ["two"]);
  assert.deepEqual(topologiesForOrganizationScope(maps, ALL_ORGANIZATIONS_SCOPE), maps);
  assert.deepEqual(topologiesForOrganizationScope(maps, "deleted-id"), []);
  assert.deepEqual(topologiesForOrganizationScope(undefined, ALL_ORGANIZATIONS_SCOPE), []);
  assert.deepEqual(topologiesForOrganizationScope([
    ...maps, { id: "guest", organizationId: "guest-id" },
  ], "guest-id", { role: "guest" }).map(({ id }) => id), ["guest"]);
});

test("new maps use the active organization or Default from the all scope", () => {
  const principal = { role: "admin", availableOrganizations: organizations };
  assert.equal(organizationForNewTopology(principal, "branch-id")?.id, "branch-id");
  assert.equal(organizationForNewTopology(principal, ALL_ORGANIZATIONS_SCOPE)?.id, "default-id");
  assert.equal(organizationForNewTopology(principal, "missing-id")?.id, "default-id");
  assert.equal(organizationForNewTopology({ role: "user", organizationIds: [], availableOrganizations: [] }, "missing-id"), null);
});
