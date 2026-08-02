# Network diagram design

## Product direction

Netdiagram is a self-contained network rack and VLAN design workstation. It runs as one static Go binary and serves a browser application with no remote assets, package manager, database, or JavaScript build step. The interface uses an industrial network-operations aesthetic: graphite rack metal, phosphor-cyan instrumentation, amber warnings, compact technical typography, and deliberately dense controls suited to infrastructure work.

## Architecture

The application is a modular monolith. `internal/model` owns the topology aggregate and validation rules. `internal/store` keeps defensive in-memory snapshots and serializes mutations through an atomic JSON persistence pipeline. `internal/handler` exposes versioned REST endpoints and serves embedded assets. `internal/sse` fans immutable events out to bounded per-client queues. The browser keeps a local topology snapshot, applies direct-manipulation updates optimistically, persists through REST, and reconciles changes received through SSE.

Store writes use a dedicated mutation lock. A mutation clones the current aggregate, validates the proposed result, writes and synchronizes a temporary file, atomically renames it, and only then publishes the new in-memory snapshot. Readers retain access to the prior valid snapshot during disk I/O. This avoids partial reads, lost updates, and long read-lock stalls.

## Interaction and rendering

Canvas owns the rack workspace, camera transforms, hit detection, device dragging, cable drafting, cable selection, and animated activity. DOM controls own toolbar actions, forms, modal VLAN management, and accessible status output. Ports are indexed during each scene layout so screen input can be transformed to world coordinates and resolved against exact device and port bounds. Cables render behind faceplates as speed-weighted Bezier paths; trunks use parallel VLAN-colored strokes.

## Reliability and security

Every JSON request has a size limit and rejects unknown fields. IDs, enums, VLAN ranges, colors, link endpoints, and occupied ports are validated on the server. Middleware supplies recovery, structured request logging, CORS policy, CSP, clickjacking protection, and content-type hardening. SSE subscribers are bounded, have explicit cancellation, and are dropped rather than allowing a slow client to block mutations.

## Verification

Unit tests cover validation, VLAN mismatch detection, loop detection, path tracing, persistence recovery, concurrent mutations, and HTTP contracts. Benchmarks cover JSON cloning and HTTP health routing. Release verification runs formatting, `go vet`, normal tests, race tests, a local health/readiness smoke test, and a Docker build/size check when Docker is available.
