# Security Policy

## Supported versions

Security fixes are applied to the current `main` branch. This project does not maintain older release branches.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. [Report a vulnerability privately through GitHub](https://github.com/arumes31/wiredraft/security/advisories/new). Include the affected version or commit, reproduction steps, expected impact, and any suggested mitigation.

If private vulnerability reporting is unavailable, contact the repository owner privately and provide only enough information to establish a secure follow-up channel. Please allow reasonable time for validation and remediation before public disclosure.

## Automated checks

Pull requests and scheduled workflows run CodeQL for Go, JavaScript, and GitHub Actions, Go and NPM vulnerability analysis, secret scanning, static security analysis, Trivy filesystem/container checks, dependency-diff review, and workflow-policy checks. CodeQL uses the Go version declared in `go.mod`. Trivy reports are retained as workflow artifacts and published to code scanning for public repositories; scan failures still fail the workflow.

OpenSSF Scorecard runs on changes to `main`, branch protection changes, and a weekly schedule. Its repository-policy findings are distinct from source vulnerabilities: branch protection requires repository settings, code review and maintenance scores reflect project history, and the best-practices badge requires a maintainer assessment. Adding CODEOWNERS does not enforce required reviews by itself.

Release artifacts include an SPDX SBOM and, for supported GitHub repositories, signed provenance and SBOM attestations.

### Go dependency reachability

The `Security` workflow runs `govulncheck ./...` on pull requests, pushes to `main`, a weekly schedule, and manual dispatch. It installs the pinned `golang.org/x/vuln/cmd/govulncheck@v1.8.0` scanner using the toolchain declared in `go.mod` (currently Go 1.27.1). Reachable known vulnerabilities and scanner errors fail the job. The same gate is available in `scripts/ci-local.ps1`, or directly:

```sh
go run golang.org/x/vuln/cmd/govulncheck@v1.8.0 ./...
```

Govulncheck distinguishes vulnerable code the application calls from findings in unused packages or modules; a clean reachability scan is not a claim that every dependency is vulnerability-free. See the [Go vulnerability management documentation](https://go.dev/doc/security/vuln/).

## Dependency and frontend rules

WireDraft currently has no OpenPGP functionality. If it is introduced, use `github.com/ProtonMail/go-crypto/openpgp`, including its subpackages, rather than `golang.org/x/crypto/openpgp`. The [Go package documentation](https://pkg.go.dev/golang.org/x/crypto/openpgp) marks the latter deprecated and recommends the maintained ProtonMail fork. Do not add an unused OpenPGP dependency in anticipation of that feature.

Keep executable JavaScript in external same-origin files under the current `script-src 'self'` Content-Security-Policy. If a future feature requires inline scripts, generate an unpredictable cryptographic nonce for every HTML response, include that nonce in both the CSP header and only the trusted script elements, and ensure caches cannot reuse or mismatch it. Do not enable `unsafe-inline` or `unsafe-eval`, use a static nonce, or attach a nonce to untrusted content. Add browser tests proving trusted scripts run and untrusted inline scripts remain blocked before shipping that feature.

## Access audit events

Successful administrator account creation and updates emit JSON logs at INFO level with stable `event` values `account_created` and `account_updated`. Each records the timestamp, `administrator_id`, and the validated, stored `user_id`. `after` contains the resulting `role`, `all_organizations`, `organization_ids`, and `disabled` state; updates also include `before`. These fields show initial grants, membership additions/removals, global access changes, role changes, and account disabling. Repeated successful updates may record identical before/after state. Names, passwords, session/CSRF tokens, and external identity details are excluded.

Events are emitted after the authentication state is successfully persisted, while the existing directory mutation lock is held. Rejected or failed mutations do not emit success events. Existing `organization created`, `organization renamed`, and `organization deleted` log messages identify the administrator and organization; deletion also removes that organization's grants.

Collect application stdout through the deployment's log collector, use JSON log format with INFO events enabled, and filter by `event`, `administrator_id`, or `user_id` when investigating access changes. Restrict log access and configure retention in that collector. These are operational logs: they are not a durable transactional audit ledger, and process failure or log delivery failure can leave a gap between persistence and collection.
