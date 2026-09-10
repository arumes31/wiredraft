FROM --platform=$BUILDPLATFORM node:24.19.0-alpine3.24@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY scripts/minify-js.mjs scripts/minify-js.mjs
COPY web/static/js web/static/js
RUN npm run minify:js

FROM --platform=$BUILDPLATFORM golang:1.27.1-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125 AS builder
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
