FROM golang:1.26-alpine@sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2 AS builder
WORKDIR /app
COPY . .
RUN mkdir /empty-data && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
      -trimpath -ldflags="-s -w -buildid=" -o /netdiagram ./cmd/server

FROM scratch
COPY --from=builder --chown=10001:10001 /netdiagram /netdiagram
COPY --from=builder --chown=10001:10001 /empty-data /data
USER 10001:10001
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=4s --start-period=5s --retries=3 CMD ["/netdiagram", "-healthcheck"]
ENTRYPOINT ["/netdiagram"]
