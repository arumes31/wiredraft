# GitHub Actions security and quality suite

## Scope and approach

Add the complete set of repository-relevant GitHub automation: formatting and linting, Go and browser tests, dependency policy, vulnerability and secret scanning, CodeQL, container scanning, OpenSSF Scorecard, SBOM generation, visual regression, and automated dependency updates. The suite must remain reproducible locally and must not require deployment credentials.

Three layouts were considered. A single workflow is compact but combines unrelated permissions and makes failures difficult to isolate. GitHub-managed default scanning is low maintenance but cannot be reviewed or reproduced from the repository. The selected layout uses small workflows with explicit permissions, timeouts, concurrency controls, immutable action SHAs, and Dependabot comments that preserve human-readable release versions.

## Workflow boundaries

`quality.yml` owns tests, coverage, race detection, fuzz seeds, browser compatibility, mutation smoke tests, and container smoke tests. `lint.yml` owns `gofmt`, `go vet`, golangci-lint, JavaScript syntax, actionlint, zizmor, ShellCheck, and Hadolint. `security.yml` owns govulncheck, gosec, npm audit, Gitleaks, filesystem/container vulnerability scans, and SARIF artifacts. Dedicated workflows own CodeQL, pull-request dependency review, OpenSSF Scorecard, visual regression, and build/SBOM provenance.

All workflows default to `contents: read`, elevate only the job that uploads security events or attestations, disable checkout credential persistence, define bounded timeouts, and cancel superseded branch runs. Scheduled security jobs supplement push and pull-request gates because vulnerability databases and action advisories change without source commits.

## Local equivalence and remediation

`scripts/ci-local.ps1` is the supported local entry point. It runs workflow linting, source linting, unit/race/coverage/fuzz tests, frontend coverage, dependency audits, SAST, secret scanning, Docker build/health checks, image scanning, SBOM generation, mutation checks, and optionally the browser/visual suites. Tools are version-pinned; container tools are pinned by version and workflow actions by full commit SHA.

GitHub-only services—dependency-review API diffs, SARIF upload, CodeQL result publication, OIDC attestations, and Scorecard publication—cannot be faithfully emulated without a GitHub run token. Their YAML is checked by actionlint and zizmor locally, while equivalent local scanners exercise the same source and artifacts. Every actionable local finding is fixed before handoff; suppressions require a narrow, documented security rationale.
