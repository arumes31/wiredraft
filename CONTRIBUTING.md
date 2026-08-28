# Contributing

WireDraft deliberately has no runtime Go module, NPM, or browser build-tool dependencies. Quality-only development tools are locked in `package-lock.json`; changes must preserve the dependency-free runtime.

1. Install Go 1.27.0 or later, Node.js 24, Docker, PowerShell 7, `golangci-lint`, `uvx`, and `act`.
2. Run `pwsh -NoProfile -File scripts/ci-local.ps1` before submitting a change. It mirrors all locally reproducible GitHub checks, including lint, race/fuzz/coverage tests, vulnerability and secret scans, container checks, browser coverage, accessibility, and visual regression.
3. During quick iteration, `-SkipBrowsers` and `-SkipContainers` may be used; the complete command is required before review.
4. Keep browser code as native ES modules under `web/static`; do not add generated bundles.
5. Add tests for domain, persistence, or API behavior changes.

Keep pull requests focused and explain any persistence-format or API compatibility impact.

GitHub-hosted services add CodeQL result upload, dependency-diff review, OpenSSF Scorecard reporting, and Sigstore artifact attestations. Enable the dependency graph, Dependabot alerts and security updates, secret scanning with push protection, and branch rules requiring the CI checks in the repository settings.
