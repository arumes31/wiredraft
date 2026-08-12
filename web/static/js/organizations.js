export const ORGANIZATION_SCOPE_STORAGE_KEY = "wiredraft.organization-scope.v1";
export const ALL_ORGANIZATIONS_SCOPE = "all";

function uniqueOrganizations(organizations) {
  const seen = new Set();
  return (organizations || []).flatMap((organization) => {
    const id = String(organization?.id || "").trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      name: String(organization?.name || "Unnamed organization").trim() || "Unnamed organization",
      isDefault: Boolean(organization?.isDefault),
    }];
  });
}

export function selectableOrganizations(principal) {
  const organizations = uniqueOrganizations(principal?.availableOrganizations);
  if (principal?.role === "admin" || principal?.allOrganizations) return organizations;
  const assigned = new Set((principal?.organizationIds || []).map(String));
  return organizations.filter(({ id }) => assigned.has(id));
}

export function organizationScopeOptions(principal) {
  const organizations = selectableOrganizations(principal);
  const allAccess = principal?.role === "admin" || Boolean(principal?.allOrganizations);
  return [
    ...(allAccess ? [{ id: ALL_ORGANIZATIONS_SCOPE, name: "All Organizations", isAll: true }] : []),
    ...organizations,
  ];
}

export function resolveOrganizationScope(principal, storedScope = "") {
  const options = organizationScopeOptions(principal);
  const requested = String(storedScope || "");
  if (options.some(({ id }) => id === requested)) return requested;
  const defaultOrganization = options.find(({ isDefault }) => isDefault);
  return defaultOrganization?.id || options.find(({ id }) => id !== ALL_ORGANIZATIONS_SCOPE)?.id || options[0]?.id || "";
}

export function topologiesForOrganizationScope(topologies, scope, principal = null) {
  if (scope === ALL_ORGANIZATIONS_SCOPE) return [...(topologies || [])];
  return (topologies || []).filter((topology) => String(topology?.organizationId || "") === String(scope || ""));
}

export function organizationForNewTopology(principal, scope) {
  const organizations = selectableOrganizations(principal);
  if (scope && scope !== ALL_ORGANIZATIONS_SCOPE) {
    const selected = organizations.find(({ id }) => id === scope);
    if (selected) return selected;
  }
  return organizations.find(({ isDefault }) => isDefault) || organizations[0] || null;
}
