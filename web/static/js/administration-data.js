export function usersWithAccess(users, organizationID) {
  return users.filter((user) => user.role === "admin" || user.allOrganizations || (user.organizationIds || []).includes(organizationID));
}

export function organizationAccess(user, organizations) {
  if (user.role === "admin" || user.allOrganizations) return "All organizations";
  const names = new Map(organizations.map(({ id, name }) => [id, name]));
  return (user.organizationIds || []).map((id) => names.get(id) || "Unknown organization").join(", ") || "No organization access";
}

export function filterUsers(users, filters = {}) {
  const query = String(filters.query || "").trim().toLocaleLowerCase();
  const scoped = filters.organization ? usersWithAccess(users, filters.organization) : users;
  return scoped.filter((user) =>
    (!query || `${user.username} ${user.externalLogin || ""}`.toLocaleLowerCase().includes(query))
    && (!filters.role || user.role === filters.role)
    && (!filters.provider || (user.authSource || "local") === filters.provider)
    && (!filters.status || Boolean(user.disabled) === (filters.status === "disabled")));
}
