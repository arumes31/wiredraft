# Organization management and global access design

## Objective

WireDraft will treat accounts as global identities and organizations as the
authorization boundary for network maps. Administrators can manage the
organization registry, grant users access to one or many organizations, and
optionally give a non-administrator access to every organization. Every map
must belong to a registered organization.

This change also completes the Microsoft Entra account flow: Entra accounts
store no local password and may be assigned either the application
administrator role or the regular user role.

## Decisions

- `Default` is created automatically, is the initial active organization, and
  cannot be renamed or deleted.
- Existing maps without an organization move to `Default` automatically.
- New and imported maps cannot exist without a valid organization.
- Accounts are not owned by an organization. A regular user can be assigned to
  multiple organizations or receive explicit all-organization access.
- Administrators always have all-organization access. That implication is
  enforced by the server and is not a separately revocable grant.
- Both local and Entra accounts can be application administrators. The
  environment-controlled bootstrap administrator remains protected and local.
- Entra accounts never receive a generated or stored local password.
- Organization deletion is blocked while at least one map references it. Once
  an unused organization is deleted, stale assignments are removed from users.
- Organization selection is a working-scope filter. It improves navigation but
  never replaces server-side authorization.

## Alternatives considered

Deriving organizations from map names was rejected because it cannot represent
an empty organization and makes rename and deletion ambiguous. Keeping a list
of organization names only inside the authentication JSON was rejected because
a rename would span topology rows and the authentication aggregate without a
stable reference.

WireDraft will use a dedicated organization registry with stable IDs. User
grants and topology ownership use those IDs; display names remain mutable. This
keeps permissions correct across renames and gives the database a concrete
referential-integrity boundary.

## Data model

An `organizations` table stores:

- a stable UUID primary key;
- a display name;
- a normalized, case-insensitive unique name;
- an `is_default` marker constrained to exactly the protected `Default` row;
- creation and update timestamps.

Topologies gain a non-null foreign key to the organization registry. The
topology aggregate and API carry both the stable organization ID and the current
display name. The foreign key is authoritative. Reads resolve the current name
from the registry so a rename does not invalidate grants or require users to be
rewritten.

Persisted users gain `allOrganizations` and organization-ID assignments. Their
role remains either `admin` or `user`; `guest` continues to be an ephemeral
principal. State validation enforces these invariants:

- an administrator has effective access to all organizations;
- a regular user has either `allOrganizations=true` or only valid organization
  assignments; creation and interactive updates require at least one, while
  deleting the user's last assigned organization safely leaves no map access
  until an administrator reassigns the account;
- an Entra user has no password hash, TOTP secret, or recovery codes;
- the bootstrap administrator cannot be disabled, demoted, or converted;
- organization assignments contain unique registered IDs.

Session principals contain the role, all-organization flag, and assigned IDs.
Authorization compares stable IDs rather than organization names.

## Startup migration

The embedded database migration creates the organization registry and topology
foreign key. Startup then performs an idempotent data upgrade before serving
requests:

1. Ensure the protected `Default` organization exists.
2. Register every distinct non-empty organization found on existing maps and in
   legacy user assignments, matching names case-insensitively.
3. Assign blank legacy maps and the initial demonstration map to `Default`.
4. Populate topology organization IDs and normalize stored topology documents.
5. Convert legacy user organization names to stable organization IDs and bump
   the authentication-state version.
6. Validate all foreign references and fail startup if any state cannot be
   converted safely.

Each database stage is transactional and the overall migration is resumable:
completed stages satisfy the same invariants when startup retries. No endpoint
is exposed until topology and authentication validation both succeed.

## Authorization behavior

Application administrators can access every map and all user and organization
management endpoints. A regular user with `allOrganizations=true` can access
every map but cannot use administrator endpoints. A scoped regular user can
only access maps whose organization ID appears in their assignments. Direct
requests for inaccessible maps continue returning `404` to avoid revealing
cross-organization resources.

Creating, replacing, restoring, or moving a map requires a registered
organization the principal can access. Administrators may choose any
organization. The guest workspace, when enabled, remains isolated and is not a
way to create unassigned maps.

Role, global-access, assignment, disabled-state, and Entra-link changes revoke
the affected user's active sessions. The user must authenticate again before
new permissions take effect.

## API

Administrator-only organization routes are added under `/api/v1/admin`:

- `GET /organizations` lists organizations and their map/user counts;
- `POST /organizations` creates an organization;
- `PUT /organizations/{organizationId}` renames an organization;
- `DELETE /organizations/{organizationId}` deletes an unused organization.

Renaming or deleting `Default` returns `403`. Deleting an organization with maps
returns `409`. Duplicate names also return `409`.

User create and update payloads gain `role`, `allOrganizations`, and
`organizationIds`. The server ignores neither contradictory nor unknown values:
it rejects malformed combinations with `400`. For administrators,
all-organization access is returned as effective state even though it is
implicit. Entra user creation accepts no password field and rejects a non-empty
password if one is supplied.

Authenticated session status includes the organizations the principal may
select and whether `All Organizations` is available. Topology summaries expose
both `organizationId` and `organization`.

## User interface

The account popover becomes the organization scope control. It displays the
active scope immediately below `IDENTITY CONTROL`. Selecting it expands an
inline list:

- administrators and regular users with global access see `All Organizations`
  plus every organization;
- scoped users see only their assigned organizations;
- users with one available organization see its name without a redundant
  switch action.

Changing scope immediately filters the map selector and navigator. The selected
scope is stored in browser-local state and revalidated after login; an invalid
or removed selection falls back to the first permitted organization. New maps
default to the active organization. From `All Organizations`, the create dialog
requires an explicit organization and initially proposes `Default`.

Administrators see two actions in the same popover:

- `USER ACCOUNTS` opens identity and grant management;
- `ORGANIZATIONS` opens organization creation, rename, map-count, and deletion
  controls.

The user form exposes application role, all-organization access, and a
multi-organization picker. Selecting Microsoft Entra disables and clears the
password input instead of generating a credential. Administrator selection
implies all organizations and disables the narrower grant controls.

## Error handling and security

All authorization decisions remain server-side. Organization IDs are parsed and
validated at request boundaries, SQL remains parameterized, and mutation paths
use transactions. Organization management responses do not expose account or
map data beyond administrator-visible counts. Audit logs record stable action
names and target IDs without tokens, passwords, Entra claims, or full request
bodies.

The UI treats a scope selection only as a filter. A forged organization ID or a
direct URL cannot widen access. Role promotion does not trust Entra directory
roles or claims; it is an explicit WireDraft administrator action.

## Validation

Backend tests cover:

- protected `Default` creation, rename denial, and delete denial;
- migration of blank maps and legacy name-based grants;
- organization create, duplicate, rename, and referenced-delete conflict;
- cleanup of assignments after deleting an unused organization;
- local and Entra administrators;
- regular users with global access and with multiple explicit assignments;
- promotion, demotion, and session revocation;
- bootstrap-administrator protections;
- cross-organization reads and writes;
- map create, replace, and import rejection without a valid organization;
- Entra creation with no password and rejection of supplied local secrets.

Frontend and end-to-end tests cover account-form behavior, organization CRUD,
scope switching, persisted selection, stale-selection fallback, filtered map
navigation, keyboard accessibility, and the existing CSP policy. Full Go tests,
the race suite, frontend unit tests, linting, and browser tests run before handoff.
