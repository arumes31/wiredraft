# Contributing

Netdiagram deliberately has no runtime, Go module, NPM, or build-tool dependencies. Changes must preserve that property.

1. Install Go 1.26.5 or later.
2. Run `go test ./...` and `go test -race ./...`.
3. Run `gofmt -w .` and `go vet ./...` before submitting a change.
4. Keep browser code as native ES modules under `web/static`; do not add generated bundles.
5. Add tests for domain, persistence, or API behavior changes.

Keep pull requests focused and explain any persistence-format or API compatibility impact.
