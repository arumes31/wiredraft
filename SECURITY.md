# Security Policy

## Supported versions

Security fixes are applied to the current `main` branch. This project does not maintain older release branches.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature for the repository. Include the affected version or commit, reproduction steps, expected impact, and any suggested mitigation.

If private vulnerability reporting is unavailable, contact the repository owner privately and provide only enough information to establish a secure follow-up channel. Please allow reasonable time for validation and remediation before public disclosure.

## Automated checks

Pull requests and scheduled workflows run CodeQL, Go and NPM vulnerability analysis, secret scanning, static security analysis, Trivy filesystem/container checks, dependency-diff review, workflow-policy checks, and OpenSSF Scorecard. Release artifacts include an SPDX SBOM and, for supported GitHub repositories, signed provenance and SBOM attestations.
