# WireDraft

<div align="center">

**Design, cable, validate, and document physical network infrastructure in one browser workspace.**

[![Core CI](https://github.com/arumes31/wiredraft/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/arumes31/wiredraft/actions/workflows/quality.yml)
[![Lint](https://github.com/arumes31/wiredraft/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/arumes31/wiredraft/actions/workflows/lint.yml)
[![Security](https://github.com/arumes31/wiredraft/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/arumes31/wiredraft/actions/workflows/security.yml)
[![Supply Chain](https://github.com/arumes31/wiredraft/actions/workflows/supply-chain.yml/badge.svg?branch=main)](https://github.com/arumes31/wiredraft/actions/workflows/supply-chain.yml)
[![Go version](https://img.shields.io/github/go-mod/go-version/arumes31/wiredraft?logo=go&logoColor=white)](https://go.dev/)
[![GHCR](https://img.shields.io/badge/GHCR-ghcr.io%2Farumes31%2Fwiredraft-2496ED?logo=docker&logoColor=white)](https://github.com/arumes31/wiredraft/pkgs/container/wiredraft)
[![License: MIT](https://img.shields.io/github/license/arumes31/wiredraft)](LICENSE)

[Quick start](#quick-start) · [First use](#first-use) · [GHCR](#run-the-ghcr-image) · [Configuration](#configuration) · [Architecture](#architecture) · [Development](#development)

</div>

WireDraft is a self-hosted rack, cabling, and VLAN planning application. A single Go server embeds the browser UI and API; PostgreSQL stores complete topology documents, revision metadata, users, TOTP state, recovery codes, and organization access. Uploaded field photos live in a separate private media volume and are delivered only after map-organization authorization.

![WireDraft rack workspace with physical links](e2e/__screenshots__/rack-faceplates.png)

## Quick start

The included Compose stack builds WireDraft locally, starts PostgreSQL, applies the initial schema to a new database, and retains data in a named volume.

### Requirements

- Docker Engine with Docker Compose v2
- Git

### Start the stack

```sh
git clone https://github.com/arumes31/wiredraft.git
cd wiredraft
cp .env.example .env
```

Open `.env` and replace both example passwords. The administrator password must contain at least 12 characters. Then start the services:

```sh
docker compose up --build -d
docker compose ps
```

Open <http://localhost:8080>. View logs or stop the stack with:

```sh
docker compose logs -f wiredraft
docker compose down
```

`docker compose down` keeps the `postgres-data` and `media-data` volumes. Running `docker compose down -v` also deletes the database and uploaded photos and is irreversible unless you have a backup.

> On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

## First use

1. Sign in with `WIREDRAFT_ADMIN_USER` and `WIREDRAFT_ADMIN_PASSWORD` from `.env`.
2. On the first administrator login, scan the QR code with a TOTP authenticator and enter its current six-digit code. If `WIREDRAFT_ADMIN_TOTP_SECRET` is already set, enrollment is skipped.
3. Download or copy the one-use recovery codes. They are displayed only when TOTP enrollment completes.
4. Open the generated demonstration map, or create a topology for an organization and location.
5. Add racks and devices, connect two ports to create a cable, then configure VLANs, bundles, switch systems, firewall clusters, documentation links, and protected field photos from the inspectors.

Guest access is enabled by default for existing guest-workspace maps. Set `WIREDRAFT_GUEST_ENABLED=false` before startup when anonymous workspace access is not wanted.

## Run the GHCR image

Images are published for `linux/amd64` and `linux/arm64`:

```sh
docker pull ghcr.io/arumes31/wiredraft:latest
```

Available tags include `latest`, `main`, `sha-<commit>`, `v<version>`, `<version>`, and `<major>.<minor>` according to the triggering branch or release tag. Use a version or digest instead of `latest` for repeatable production deployments.

The repository includes a standalone [GHCR Compose stack](docker-compose.ghcr.yml) with both the application and PostgreSQL. It mounts `db/migrations` into new PostgreSQL containers, keeps the database and protected media on separate named volumes, waits for database readiness, and runs the application with a read-only root filesystem and dropped Linux capabilities. The accompanying [.env.example](.env.example) lists every setting accepted by this stack with runnable defaults and placeholder credentials.

Start it from a WireDraft checkout:

```sh
cp .env.example .env
# Replace the credentials in .env before continuing.
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

Set `WIREDRAFT_IMAGE` in `.env` to pin a release tag or digest without editing the Compose file, for example `WIREDRAFT_IMAGE=ghcr.io/arumes31/wiredraft:1.2.3`.

Compose-specific settings are separate from the application configuration below:

| Environment variable | Default | Description |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `wiredraft` | Compose project and generated resource-name prefix |
| `WIREDRAFT_IMAGE` | `ghcr.io/arumes31/wiredraft:latest` | Application image tag or digest |
| `POSTGRES_IMAGE` | pinned PostgreSQL 17 Alpine digest | PostgreSQL image tag or digest |
| `WIREDRAFT_BIND_ADDRESS` | `0.0.0.0` | Host address that publishes the web port; use `127.0.0.1` behind a local reverse proxy |
| `WIREDRAFT_PUBLISHED_PORT` | `8080` | Host-side web port |
| `POSTGRES_DB` | `wiredraft` | Database initialized in a new PostgreSQL volume |
| `POSTGRES_USER` | `wiredraft` | Database owner initialized in a new PostgreSQL volume |
| `POSTGRES_PASSWORD` | required | Password for the bundled PostgreSQL container; replace the placeholder before startup |

The app connection defaults (`PGDATABASE`, `PGUSER`, and `PGPASSWORD`) must match the bundled PostgreSQL settings. `PGPASSWORD` may be left empty in `.env` to reuse `POSTGRES_PASSWORD`. For an external database, set `DATABASE_URL` or the five `PG*` connection variables; the included PostgreSQL service will still start unless you remove it from the copied deployment file.

`PORT` is the container-side listen port while `WIREDRAFT_PUBLISHED_PORT` is the host-side port. If `PORT` changes, update `HEALTHCHECK_URL` to the same container port. `WIREDRAFT_MEDIA_DIR` must be an absolute in-container path in this Compose deployment; the protected `media-data` volume is mounted at that path automatically.

The published runtime image is `FROM scratch`, contains only the statically linked server, runs as numeric user `10001`, and has no shell or package manager. Its built-in `-healthcheck` command probes `/api/v1/health` without adding a second binary.

## Features

### Rack and hardware planning

- Multi-rack layouts with 6U–48U frames, independent front/rear rails, per-rack face switching, whole-U snapping, collision prevention, hidden-side silhouettes, grouped cable portals, trace-expanded dual-face views, capacity reporting, free-floating devices, and a navigable minimap.
- High-DPI faceplates for switches, firewalls, routers, carrier handoffs, modems, access points, servers, patch panels, storage, power, and console equipment.
- Offline 542-profile hardware catalog with vendor-family layouts and 25 connector types up to 800G OSFP, plus JSON profile import.
- Generic 1U–4U server rear builder with mixed card bays and independently cableable ports.
- Copper and fiber patch panels with independent front/rear occupancy, editable rear mappings, and atomic one-to-one panel ranges.

### Physical cabling

- Magnetic port-to-port drafting with precise connector hit testing and automatic endpoint link-state updates.
- Deterministic orthogonal routing, rack-side/inter-rack gutters, crossing underpasses, bundled device-pair tracks, and separated vertical lanes in dense layouts.
- Cable media and transceiver metadata for copper, coax, SMF/MMF, DAC, AOC, and twinax.
- Trunk, LACP, MC-LAG, and failover link groups with shared labels, primary/backup roles, group-wide VLAN editing, and complete-path hover highlighting.
- Canvas and SVG exports use the same Manhattan route geometry and native/tagged VLAN conductors.

### Layer 2 modeling and analysis

- Access, trunk, hybrid, and unconfigured switchport models with native and tagged VLAN membership.
- Logical switch systems for generic stacks, Aruba VSF, Cisco StackWise/VSS, Fortinet MC-LAG, Juniper Virtual Chassis, HPE/H3C IRF, and custom fabrics.
- Active/active and active/passive firewall clusters with active-member selection and safe failover reassignment.
- Per-VLAN spanning-tree simulation with deterministic root election and Root, Designated, and Blocked port roles.
- Server-side detection of native VLAN mismatches, tagged VLAN drops, switching loops, invalid bundles, and forwarding paths.

### Collaboration and output

- Revision-aware autosave, manual save, undo/redo, optimistic conflict detection, and per-topology Server-Sent Events.
- Anchored comment threads, HTTP(S) documentation links, and revocable tokenized read-only shares.
- Export to A3 PDF, self-contained interactive HTML, configuration workbook, PNG, SVG, and JSON; the HTML viewer embeds its CSS, source data, search, pan/zoom, hover tracing, face filters, and inspector without remote assets, while JSON can be restored as a topology backup.
- Device inventory for hostname, management IP, serial, asset tag, owner/team, site hierarchy, rack/U position, and STP priority.

### Runtime and security

- Local password and TOTP authentication, one-use recovery codes, opaque host-bound sessions, organization-scoped users, and administrator user management.
- Strict JSON decoding, request size limits, same-origin and CSRF enforcement, security headers, structured logs, database transactions, and graceful shutdown.
- Embedded native ES-module frontend with no runtime Node.js dependency; release builds minify modules before `go:embed` compilation.
- Responsive controls, keyboard-visible focus, reduced-motion support, adaptive graphics quality, bounded frame rates, and suspended rendering for hidden canvases.

## Architecture

```mermaid
flowchart LR
    U[Browser] -->|HTML, CSS, ES modules| S[WireDraft Go server]
    U <-->|REST /api/v1| A[HTTP handlers]
    U <-->|revisioned SSE| E[SSE broker]
    S --> A
    S --> E
    A --> M[Topology model and analyzer]
    A --> X[Authentication and authorization]
    M --> P[(PostgreSQL)]
    X --> P
    S -. embeds at build time .-> W[web/static]
```

WireDraft stores each topology as a validated JSONB aggregate alongside indexed summary and revision fields. Mutations lock the row, enforce the optional `If-Match: "rev-N"` precondition, validate the next aggregate, increment its revision, and commit atomically.

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as Go API
    participant DB as PostgreSQL
    participant SSE as SSE subscribers
    B->>API: Mutation + If-Match: "rev-N"
    API->>DB: SELECT ... FOR UPDATE
    DB-->>API: Document + revision N
    API->>API: Apply, normalize, validate
    API->>DB: UPDATE document, revision N+1
    DB-->>API: Commit
    API-->>B: Updated topology + ETag
    API-->>SSE: Publish revision N+1
```

### Persistent data

| PostgreSQL object | Contents |
| --- | --- |
| `topologies` | Complete topology JSONB documents plus name, organization, location, revision, counts, and timestamps |
| `auth_state` | Users, organization grants, password/TOTP/recovery state, guest workspace membership, and the 32-byte key used to encrypt authenticator secrets |
| `postgres-data` volume | The complete database used by the included Compose deployment |
| `media-data` volume | Randomly renamed JPEG/PNG attachments, isolated by topology and never exposed as a browsable static directory |

Back up PostgreSQL and `media-data` together to preserve topology, authentication state, and uploaded photos. A JSON export contains attachment metadata but not the photo bytes, so it is not a replacement for these backups.

```sh
docker compose exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > wiredraft-backup.sql
```

PostgreSQL runs on `127.0.0.1:5432` in the included development Compose file. Do not expose it publicly. The scripts in `db/migrations` are applied automatically only when PostgreSQL initializes an empty data directory; apply later migrations explicitly to existing databases before starting a newer application version.

## Configuration

WireDraft reads environment variables first and lets command-line flags override the supported server options.

| Environment variable | Flag | Default | Description |
| --- | --- | --- | --- |
| `PORT` | `-port` | `8080` | HTTP listen port |
| `DATABASE_URL` | — | empty | PostgreSQL URL; when empty, pgx reads the standard `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, and related variables |
| `PGHOST` | — | pgx default | PostgreSQL host when `DATABASE_URL` is empty; the GHCR Compose stack uses `postgres` |
| `PGPORT` | — | pgx default | PostgreSQL port when `DATABASE_URL` is empty; the GHCR Compose stack uses `5432` |
| `PGDATABASE` | — | pgx default | PostgreSQL database when `DATABASE_URL` is empty; the GHCR Compose stack uses `wiredraft` |
| `PGUSER` | — | pgx default | PostgreSQL user when `DATABASE_URL` is empty; the GHCR Compose stack uses `wiredraft` |
| `PGPASSWORD` | — | pgx default | PostgreSQL password when `DATABASE_URL` is empty; Compose reuses `POSTGRES_PASSWORD` when this is unset |
| `WIREDRAFT_MEDIA_DIR` | `-media-dir` | `data/media` | Private photo root; Compose sets this to `/media` and mounts the `media-data` volume there |
| `LOG_LEVEL` | `-log-level` | `info` | `debug`, `info`, `warn`, or `error` |
| `LOG_FORMAT` | `-log-format` | `json` | `json` or `text` |
| `WIREDRAFT_ADMIN_USER` | — | `admin` | Bootstrap administrator username |
| `WIREDRAFT_ADMIN_PASSWORD` | — | required | Bootstrap administrator password; minimum 12 characters |
| `WIREDRAFT_ADMIN_TOTP_SECRET` | — | empty | Optional Base32 TOTP secret; empty starts QR enrollment on first login |
| `WIREDRAFT_GUEST_ENABLED` | — | `true` | Enables guest-workspace login |
| `WIREDRAFT_COOKIE_SECURE` | — | `false` | Sends the session cookie only over HTTPS |
| `HEALTHCHECK_URL` | `-healthcheck-url` | `http://127.0.0.1:8080/api/v1/health` | Target used with `-healthcheck` |

The legacy `NETDIAGRAM_ADMIN_*`, `NETDIAGRAM_GUEST_ENABLED`, and `NETDIAGRAM_COOKIE_SECURE` variables remain fallback aliases. When both names are set, `WIREDRAFT_*` wins.

### Production checklist

- Use long, unique values for the database and administrator passwords.
- Disable guest access unless it is intentionally required.
- Terminate TLS at a trusted reverse proxy and set `WIREDRAFT_COOKIE_SECURE=true`.
- Keep PostgreSQL on a private network and back up its data volume.
- Back up `media-data` with PostgreSQL; do not publish or serve the media volume directly from a reverse proxy.
- Pin the WireDraft image to a release tag or digest and apply database migrations before upgrades.
- Preserve the `auth_state` row with the rest of the database; its encryption key is required to read stored TOTP secrets.

## HTTP API

The versioned API is rooted at `/api/v1`.

| Area | Routes |
| --- | --- |
| Health and authentication | `/health`, `/auth/*`, `/admin/users` |
| Topologies and inventory | `/topologies`, `/topologies/{id}`, `/racks`, `/devices`, `/ports` |
| Protected photos | `/topologies/{id}/photos` and `/topologies/{id}/photos/{photoId}` |
| Cabling and logical systems | `/links`, `/link-groups`, `/switch-systems`, `/firewall-clusters` |
| Network intent | `/vlans`, `/analysis`, `/trace` |
| Collaboration | `/events`, `/comments`, `/documentation-links`, `/shares` |
| Public read-only access | `/shared/{topologyId}/{token}` |

Mutations support optimistic concurrency with `If-Match: "rev-N"`. Error responses use `{ "error": "message", "code": 400 }`. The browser client is the current request-body reference, and the persisted domain schema is defined in `internal/model`.

## Development

### Toolchain

- Go 1.26.5 or later
- PostgreSQL 14 or later
- Node.js 24 for tests and release-time minification only
- Docker, PowerShell 7, and the quality tools listed in [CONTRIBUTING.md](CONTRIBUTING.md) for the full CI mirror

Start PostgreSQL from Compose and run the application natively:

```sh
docker compose up -d postgres
```

```powershell
$env:PGHOST = "127.0.0.1"
$env:PGPORT = "5432"
$env:PGDATABASE = "wiredraft"
$env:PGUSER = "wiredraft"
$env:PGPASSWORD = "the-password-from-.env"
$env:WIREDRAFT_ADMIN_PASSWORD = "a-long-local-admin-password"
go run ./cmd/server
```

Build a static binary:

```sh
make build
./wiredraft
```

Without `make`:

```sh
go build -trimpath -ldflags="-s -w" -o wiredraft ./cmd/server
```

### Tests and quality gates

```sh
go test ./...
go test -race ./...
npm ci
npm run test:unit
npm run test:coverage
npm run test:e2e
```

The Core CI workflow enforces at least 70% Go statement coverage and 80% frontend line, function, and branch coverage. Run the complete locally reproducible suite from PowerShell 7 before review:

```powershell
pwsh -NoProfile -File scripts/ci-local.ps1
```

For quicker iteration, `-SkipBrowsers` and `-SkipContainers` are available. The full command also checks formatting, lint, race/fuzz coverage, dependencies, secrets, Docker, SBOM output, mutation behavior, supported browsers, accessibility, and visual regression. GitHub additionally runs CodeQL, dependency review, OpenSSF Scorecard, and build/SBOM attestations.

### Project layout

```text
cmd/server/          Application entry point and health probe
db/migrations/       PostgreSQL schema migrations
internal/auth/       Password, TOTP, recovery, sessions, and user access
internal/config/     Environment and flag parsing
internal/handler/    HTTP API, middleware, static delivery, and authorization
internal/model/      Topology domain, validation, STP, tracing, and analysis
internal/store/      PostgreSQL persistence and revision transactions
internal/sse/        Per-topology event broker
web/static/          Embedded browser application
web/*_test.mjs       Frontend unit and contract tests
e2e/                 Playwright, accessibility, and visual tests
scripts/             CI mirror, minification, and mutation helpers
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Keep changes focused, add tests for behavioral changes, and call out persistence or API compatibility effects.

Security issues should be reported privately as described in [SECURITY.md](SECURITY.md).

## License

WireDraft is available under the [MIT License](LICENSE).
