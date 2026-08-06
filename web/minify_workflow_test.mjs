import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { minifyJavaScriptTree } from "../scripts/minify-js.mjs";

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

test("minifier preserves the module tree and writes a deterministic manifest", async () => {
  const fixtureRoot = await mkdtemp(path.join(process.cwd(), ".quality-data-minify-test-"));
  const sourceDirectory = path.join(fixtureRoot, "source");
  const outputDirectory = path.join(fixtureRoot, "output");
  const nestedDirectory = path.join(sourceDirectory, "nested");
  const firstSource = `
    export function describeDevice(device) {
      const displayName = device.displayName || "Unnamed device";
      const portCount = Array.isArray(device.ports) ? device.ports.length : 0;
      return displayName + " has " + portCount + " ports";
    }
  `;
  const secondSource = `
    import { describeDevice } from "../device.js";
    export const label = describeDevice({
      displayName: "Core switch",
      ports: [1, 2, 3, 4],
    });
  `;

  try {
    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(path.join(sourceDirectory, "device.js"), firstSource, "utf8");
    await writeFile(path.join(nestedDirectory, "label.js"), secondSource, "utf8");

    const manifest = await minifyJavaScriptTree({
      sourceDirectory,
      outputDirectory,
    });
    const firstOutput = await readFile(path.join(outputDirectory, "device.js"), "utf8");
    const secondOutput = await readFile(path.join(outputDirectory, "nested", "label.js"), "utf8");
    const savedManifest = JSON.parse(
      await readFile(path.join(outputDirectory, "manifest.json"), "utf8"),
    );

    assert.equal(manifest.fileCount, 2);
    assert.equal(savedManifest.fileCount, 2);
    assert.deepEqual(manifest.files.map((file) => file.path), ["device.js", "nested/label.js"]);
    assert.ok(manifest.outputBytes < manifest.sourceBytes);
    assert.equal(manifest.files[0].sourceSha256, sha256(firstSource));
    assert.equal(manifest.files[0].outputSha256, sha256(firstOutput));
    assert.match(firstOutput, /export/);
    assert.match(secondOutput, /from"\.\.\/device\.js"/);
    assert.equal(await readFile(path.join(sourceDirectory, "device.js"), "utf8"), firstSource);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("minified HTML exports retain an executable embedded interaction controller", async () => {
  const fixtureRoot = await mkdtemp(path.join(process.cwd(), ".quality-data-export-minify-test-"));
  const outputDirectory = path.join(fixtureRoot, "output");
  const engine = {
    worldBounds: () => ({ x: 0, y: 0, width: 800, height: 500 }),
    portCenters: () => new Map(), rackRectangles: () => [], deviceRectangles: () => [],
  };

  try {
    await minifyJavaScriptTree({ sourceDirectory: "web/static/js", outputDirectory });
    const moduleURL = `${pathToFileURL(path.join(outputDirectory, "export.js")).href}?test=${Date.now()}`;
    const { buildHTMLDocument } = await import(moduleURL);
    const html = buildHTMLDocument({ name: "Minified export", racks: [], devices: [], links: [], vlans: [] }, engine);
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([^]*?)<\/script>/g)].map((match) => match[1]);
    const controller = scripts.at(-1);

    assert.match(controller, /^\(function\s+[^(]+\(\)\{[^]*\}\)\(\);?$/,
      "the mangled bootstrap must invoke itself without relying on its source identifier");
    assert.doesNotThrow(() => new Function(controller), "the embedded minified controller must remain valid JavaScript");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("minification workflow is locked down and publishes only generated artifacts", async () => {
  const workflow = await readFile(".github/workflows/minify-js.yml", "utf8");

  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm run minify:js/);
  assert.match(workflow, /xargs -0 -n1 node --check/);
  assert.match(workflow, /path: \.quality-data\/minified-js\//);
  assert.match(workflow, /if-no-files-found: error/);
});

test("container and release builds embed minified modules before Go compilation", async () => {
  const [dockerfile, dockerignore, supplyChain, qualityWorkflow, localCI] = await Promise.all([
    readFile("Dockerfile", "utf8"),
    readFile(".dockerignore", "utf8"),
    readFile(".github/workflows/supply-chain.yml", "utf8"),
    readFile(".github/workflows/quality.yml", "utf8"),
    readFile("scripts/ci-local.ps1", "utf8"),
  ]);

  assert.match(dockerfile, /^FROM --platform=\$BUILDPLATFORM node:24\.[^\s]+@sha256:[0-9a-f]{64} AS frontend/m);
  assert.match(dockerfile, /RUN npm ci --ignore-scripts/);
  assert.match(dockerfile, /RUN npm run minify:js/);
  assert.match(dockerfile, /COPY --from=frontend \/app\/\.quality-data\/minified-js\/ \/app\/web\/static\/js\//);
  assert.match(dockerfile, /rm -f web\/static\/js\/manifest\.json/);
  assert.ok(
    dockerfile.indexOf("COPY --from=frontend") < dockerfile.indexOf("go build"),
    "minified modules must replace sources before go:embed runs",
  );
  assert.match(dockerfile, /GOOS="\$TARGETOS" GOARCH="\$TARGETARCH"/);
  assert.doesNotMatch(dockerfile, /ARG TARGET(?:OS|ARCH)=/);

  assert.doesNotMatch(dockerignore, /^package\*\.json$/m);
  assert.doesNotMatch(dockerignore, /^scripts$/m);
  assert.match(dockerignore, /^!scripts\/minify-js\.mjs$/m);

  assert.match(supplyChain, /packages: write/);
  assert.match(supplyChain, /npm run minify:js/);
  assert.match(supplyChain, /ghcr\.io\/\$\{\{ github\.repository \}\}/);
  assert.match(supplyChain, /docker\/login-action@[0-9a-f]{40}/);
  assert.match(supplyChain, /docker\/metadata-action@[0-9a-f]{40}/);
  assert.match(supplyChain, /docker\/setup-qemu-action@[0-9a-f]{40}/);
  assert.match(supplyChain, /docker\/setup-buildx-action@[0-9a-f]{40}/);
  assert.match(supplyChain, /docker\/build-push-action@[0-9a-f]{40}/);
  assert.match(supplyChain, /platforms: linux\/amd64,linux\/arm64/);
  assert.match(supplyChain, /push: true/);
  assert.match(supplyChain, /provenance: mode=max/);
  assert.match(supplyChain, /sbom: true/);

  assert.match(qualityWorkflow, /Verify embedded JavaScript is minified/);
  assert.match(qualityWorkflow, /\/js\/app\.js/);
  assert.match(qualityWorkflow, /served_bytes >= source_bytes/);
  assert.match(localCI, /Container health and minified assets/);
  assert.match(localCI, /Container app\.js does not match the locked minification output/);
});
