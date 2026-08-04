.PHONY: build run test race vet ci-local docker-build docker-run

build:
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o netdiagram ./cmd/server

run:
	go run ./cmd/server

test:
	go test -v ./...

race:
	go test -race ./...

vet:
	go vet ./...

ci-local:
	pwsh -NoProfile -File scripts/ci-local.ps1

docker-build:
	docker build -t netdiagram:latest .

docker-run:
	docker compose up --build
