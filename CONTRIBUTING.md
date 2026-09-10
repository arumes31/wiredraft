# Contributing

WireDraft compiles its Go module dependencies into the server binary and serves native browser ES modules. Frontend development and minification tools are locked in `package-lock.json`; Node.js is not required at runtime. Keep Go dependencies and checksums in `go.mod` and `go.sum` up to date together.

1. Install Go 1.27.1 or later, Node.js 24, Docker, PowerShell 7, `golangci-lint`, `uvx`, and `act`.
2. Run `pwsh -NoProfile -File scripts/ci-local.ps1` before submitting a change. It mirrors all locally reproducible GitHub checks, including lint, race/fuzz/coverage tests, vulnerability and secret scans, container checks, browser coverage, accessibility, and visual regression.
3. During quick iteration, `-SkipBrowsers` and `-SkipContainers` may be used; the complete command is required before review.
4. Keep browser code as native ES modules under `web/static`; do not add generated bundles.
5. Add tests for domain, persistence, or API behavior changes.

Keep pull requests focused and explain any persistence-format or API compatibility impact.

### Physical faceplates

Model geometry lives in `web/static/js/faceplate-models.js`. Add only documented SKUs, cite the official guide and panel pages, and compose normalized components and typed port slots for each physical face. Coordinates describe a traced illustration, not manufacturing dimensions. Unknown variants retain their existing schematic layouts. Preserve inventory `portIndex` and IDs so user labels and cabling remain stable.

`faceplate-scene.js` converts the model into shared world coordinates for Canvas drawing, picking, cable routing, and SVG export. `hardware-components.js` defines connector and chassis-component artwork once, with Canvas and SVG adapters consuming the same primitives. Keep application overlays and rack mounting separate from physical panel metadata. Rebuild the Go server after changing embedded browser assets before visual verification.

Run the faceplate model, scene, hardware component, and export tests, `npm run audit:faceplates`, and `e2e/faceplate-panels.spec.mjs` for layout changes. Inspect both physical faces and verify connectors and hidden-panel cable anchors in Canvas and SVG.

GitHub-hosted services add CodeQL result upload, dependency-diff review, OpenSSF Scorecard reporting, and Sigstore artifact attestations. Enable the dependency graph, Dependabot alerts and security updates, secret scanning with push protection, and branch rules requiring the CI checks in the repository settings.
