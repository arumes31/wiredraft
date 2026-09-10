import assert from "node:assert/strict";
import test from "node:test";
import { filterUsers, organizationAccess, usersWithAccess } from "./static/js/administration-data.js";

const organizations = [{ id: "a", name: "Vienna" }, { id: "b", name: "Linz" }];
const users = [
  { id: "1", username: "Admin", role: "admin", organizationIds: [] },
  { id: "2", username: "Alex", externalLogin: "alex@example.com", role: "user", authSource: "entra", organizationIds: ["a"] },
  { id: "3", username: "Sam", role: "user", allOrganizations: true, disabled: true },
  { id: "4", username: "Pat", role: "user", organizationIds: ["b"] },
];

test("organization membership includes application administrators and global access", () => {
  assert.deepEqual(usersWithAccess(users, "a").map(({ id }) => id), ["1", "2", "3"]);
  assert.equal(organizationAccess(users[0], organizations), "All organizations");
  assert.equal(organizationAccess(users[1], organizations), "Vienna");
  assert.equal(organizationAccess({ organizationIds: [] }, organizations), "No organization access");
  assert.equal(organizationAccess({ organizationIds: ["missing"] }, organizations), "Unknown organization");
});

test("directory filters combine search, status, role, provider and effective organization access", () => {
  assert.deepEqual(filterUsers(users, { query: " EXAMPLE.COM ", organization: "a", status: "active", provider: "entra" }).map(({ id }) => id), ["2"]);
  assert.deepEqual(filterUsers(users, { organization: "b", role: "user", status: "disabled" }).map(({ id }) => id), ["3"]);
  assert.deepEqual(filterUsers(users, { query: "ADMIN", provider: "local" }).map(({ id }) => id), ["1"]);
  assert.deepEqual(filterUsers(users, { query: "no match" }), []);
  assert.equal(filterUsers(users).length, 4);
});
