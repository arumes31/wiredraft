# Quality and test infrastructure

The quality suite maps directly to ideas 396–420 in `docs/plans/ideas1.md`.

| Idea | Executable artifact |
| --- | --- |
| 396 | `internal/model/validation_edge_test.go` exercises every aggregate validator and boundary values. |
| 397, 404 | `web/cable_routing_test.mjs` and fixture snapshots in `web/testdata/cable-routes.json`. Routing lives in the browser, so correctness is tested at its implementation boundary rather than duplicated in Go. |
| 398 | `internal/handler/api_quality_test.go` runs complete HTTP request/response lifecycles. |
| 399–400 | `internal/model/quality_benchmark_test.go` benchmarks JSON, analysis, and path tracing at several sizes. |
| 401 | Native Go fuzz targets cover topology JSON and strict HTTP JSON decoding. |
| 402–403 | Browser-module tests cover hit-test boundaries and deterministic VLAN palettes. |
| 405–406 | Playwright critical-workflow and opt-in pixel snapshot suites. Generate reviewed baselines with `npm run test:visual:update`. |
| 407, 417, 419 | The checked-in v1 API response contract snapshot fails on field/value drift. |
| 408 | `go run ./cmd/loadtest` drives concurrent API requests and SSE clients against a running instance. |
| 409 | `web/sse_reconnect_chaos_test.mjs` repeatedly kills the transport and verifies bounded reconnection. |
| 410 | Versioned fixtures below `internal/store/testdata/migrations` must continue to load and normalize. |
| 411–412 | Playwright projects cover Chromium, Firefox, WebKit/Safari, Edge, and axe-core accessibility. |
| 413–414 | Go and c8 LCOV reports are uploaded by CI. Coverage gates are ratchets: Go starts at 60% and frontend at 65% lines/55% functions/70% branches; the tracked Go target is >80%. Thresholds must only move upward. |
| 415 | `scripts/mutation-smoke.sh` injects a VLAN-boundary mutant and requires the suite to kill it. |
| 416 | `internal/testutil` and `go run ./cmd/topologygen` create deterministic topologies with configurable devices, ports, and VLANs. |
| 418 | CSS token/selector contracts and Playwright pixel snapshots detect visual regressions. |
| 420 | CI builds the scratch image and blocks HIGH/CRITICAL findings with Trivy. |

## Local commands

```text
go test ./...
go test ./internal/model -bench=. -benchtime=2s
go test ./internal/model -run=^$ -fuzz=FuzzTopologyJSON -fuzztime=30s
npm ci
npm run test:coverage
npm run test:e2e
go run ./cmd/topologygen -devices 1000 -ports 8 -vlans 32 > topology.json
go run ./cmd/loadtest -url http://127.0.0.1:8080 -workers 32 -sse 128 -duration 30s
```

WebKit is the Safari rendering-engine gate on non-macOS CI. The Edge project uses the installed Microsoft Edge channel on the Windows runner. Trivy and actual browser execution require their CI-provided binaries; the unit, contract, generator, benchmark, and fuzz-seed tests require only Go and Node.
