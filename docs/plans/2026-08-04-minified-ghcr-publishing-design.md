# Minified GHCR Publishing Design

## Goal

Publish reproducible WireDraft container images whose embedded browser modules are minified, without adding Node.js or build tooling to the runtime image.

## Build boundary

The Dockerfile owns frontend production packaging. A pinned Node 24 stage installs the locked quality dependencies with lifecycle scripts disabled and runs the same `minify:js` command used by pull-request validation. The Go stage copies the repository, overlays the generated JavaScript tree, removes its build manifest, and only then compiles the server. Because `web.Static` uses `go:embed`, the resulting binary contains the minified modules. The final scratch stage still copies only that binary and an empty `/data` directory.

BuildKit supplies `TARGETOS` and `TARGETARCH`, allowing one Dockerfile to produce native `linux/amd64` and `linux/arm64` images. Release binaries use the same locked transform before their direct Go builds and publish the minification manifest with their checksums and SBOM.

## Registry publishing

The supply-chain workflow authenticates to GHCR with the job-scoped `GITHUB_TOKEN` and `packages: write`. Commit-pinned Docker actions set up QEMU and Buildx, normalize the repository image name, derive branch, version, SHA, and `latest` tags, and push a two-platform image index. BuildKit attaches maximal provenance and an SBOM. The job runs only on main, `v*` tags, or manual dispatch—never on untrusted pull requests.

## Verification

Static contracts enforce pinned actions, restricted permissions, multi-platform publication, provenance, SBOM generation, and the ordering of minification before Go compilation. Local validation builds the actual Dockerfile, starts the scratch image, fetches a JavaScript module over HTTP, and compares it with the readable source to prove that the embedded response is valid and smaller.
