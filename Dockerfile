FROM --platform=$BUILDPLATFORM node:24.18.0-alpine3.24@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY scripts/minify-js.mjs scripts/minify-js.mjs
COPY web/static/js web/static/js
RUN npm run minify:js

FROM --platform=$BUILDPLATFORM golang:1.27-alpine@sha256:4c9fe60190a2a3350ddc51de80d0224b8a6698d12bdfc999fee45ea9d6c46dbc AS builder
WORKDIR /app
COPY . .
COPY --from=frontend /app/.quality-data/minified-js/ /app/web/static/js/
ARG TARGETOS
ARG TARGETARCH
RUN rm -f web/static/js/manifest.json && \
    CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" go build \
      -trimpath -ldflags="-s -w -buildid=" -o /wiredraft ./cmd/server
RUN mkdir -p /media

FROM scratch
COPY --from=builder --chown=10001:10001 /wiredraft /wiredraft
COPY --from=builder --chown=10001:10001 /media /media
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=4s --start-period=5s --retries=3 CMD ["/wiredraft", "-healthcheck"]
ENTRYPOINT ["/wiredraft"]
