.PHONY: build run test race vet docker-build docker-run

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

docker-build:
	docker build -t netdiagram:latest .

docker-run:
	docker compose up --build
