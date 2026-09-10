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
