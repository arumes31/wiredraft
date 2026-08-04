# JavaScript Minification Workflow Design

## Goal

Produce a reviewable, deployable minified copy of every native browser module without replacing the readable modules embedded in the development binary or committing generated files.

## Design

- `npm run minify:js` transforms each `web/static/js/**/*.js` file independently with a pinned esbuild version, retaining its relative path and ES-module imports.
- Output is rebuilt from scratch in the ignored `.quality-data/minified-js` directory. Source and output directories are required to be separate children of the repository before cleanup is allowed.
- A deterministic `manifest.json` records every relative path, byte count, and SHA-256 digest. The task fails when the source tree is empty or the aggregate output is not smaller.
- The GitHub workflow uses read-only permissions and commit-pinned actions, validates every generated module with Node, and uploads the complete directory for 14 days.
- The local CI runner executes the same build and syntax validation so failures can be reproduced before a push.

The standalone artifact remains separate from `web/static`, but release packaging consumes the same locked transformation. The Dockerfile builds the minified module tree in a pinned Node stage and overlays it immediately before `go build`, so every local, scanned, and GHCR image embeds minified JavaScript. The supply-chain binary job performs the equivalent overlay before compiling both architectures and includes the size/hash manifest beside the binaries.

The final scratch image remains unchanged: it contains only the compiled server and the empty `/data` mount point. Node, NPM, esbuild, source files, and the minification manifest exist only in build stages.
