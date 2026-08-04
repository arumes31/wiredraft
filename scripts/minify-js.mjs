import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { transform } from "esbuild";

const DEFAULT_SOURCE_DIRECTORY = "web/static/js";
const DEFAULT_OUTPUT_DIRECTORY = ".quality-data/minified-js";

function isWithin(parent, candidate) {
  const relativePath = path.relative(parent, candidate);
  return relativePath === "" || (
    !relativePath.startsWith(`..${path.sep}`)
    && relativePath !== ".."
    && !path.isAbsolute(relativePath)
  );
}

function resolveDirectories(sourceDirectory, outputDirectory) {
  const workingDirectory = path.resolve(process.cwd());
  const source = path.resolve(workingDirectory, sourceDirectory);
  const output = path.resolve(workingDirectory, outputDirectory);

  if (!isWithin(workingDirectory, source)) {
    throw new Error("The source directory must be inside the repository.");
  }
  if (!isWithin(workingDirectory, output) || output === workingDirectory) {
    throw new Error("The output directory must be a child of the repository.");
  }
  if (isWithin(source, output) || isWithin(output, source)) {
    throw new Error("Source and output directories must not contain each other.");
  }

  return { source, output, workingDirectory };
}

async function listJavaScriptFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJavaScriptFiles(entryPath, root));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path.relative(root, entryPath));
    }
  }

  return files;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function toPortablePath(filePath) {
  return filePath.split(path.sep).join("/");
}

export async function minifyJavaScriptTree({
  sourceDirectory = DEFAULT_SOURCE_DIRECTORY,
  outputDirectory = DEFAULT_OUTPUT_DIRECTORY,
} = {}) {
  const { source, output, workingDirectory } = resolveDirectories(
    sourceDirectory,
    outputDirectory,
  );

  const sourceInfo = await stat(source).catch(() => null);
  if (!sourceInfo?.isDirectory()) {
    throw new Error(`JavaScript source directory does not exist: ${sourceDirectory}`);
  }

  const relativeFiles = await listJavaScriptFiles(source);
  if (relativeFiles.length === 0) {
    throw new Error(`No JavaScript files found in ${sourceDirectory}`);
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  const files = [];
  let sourceBytes = 0;
  let outputBytes = 0;

  for (const relativeFile of relativeFiles) {
    const sourcePath = path.join(source, relativeFile);
    const outputPath = path.join(output, relativeFile);
    const sourceCode = await readFile(sourcePath, "utf8");
    const result = await transform(sourceCode, {
      charset: "utf8",
      format: "esm",
      legalComments: "none",
      loader: "js",
      minify: true,
      sourcefile: toPortablePath(relativeFile),
      sourcemap: false,
      target: "es2022",
    });

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.code, "utf8");

    const sourceSize = Buffer.byteLength(sourceCode);
    const outputSize = Buffer.byteLength(result.code);
    sourceBytes += sourceSize;
    outputBytes += outputSize;
    files.push({
      path: toPortablePath(relativeFile),
      sourceBytes: sourceSize,
      outputBytes: outputSize,
      sourceSha256: sha256(sourceCode),
      outputSha256: sha256(result.code),
    });
  }

  if (outputBytes >= sourceBytes) {
    await rm(output, { recursive: true, force: true });
    throw new Error(
      `Minification did not reduce the JavaScript tree (${sourceBytes} -> ${outputBytes} bytes).`,
    );
  }

  const savedBytes = sourceBytes - outputBytes;
  const manifest = {
    formatVersion: 1,
    sourceRoot: toPortablePath(path.relative(workingDirectory, source)),
    outputRoot: toPortablePath(path.relative(workingDirectory, output)),
    fileCount: files.length,
    sourceBytes,
    outputBytes,
    savedBytes,
    reductionPercent: Number(((savedBytes / sourceBytes) * 100).toFixed(2)),
    files,
  };

  await writeFile(
    path.join(output, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return manifest;
}

function optionValue(argumentsList, name, fallback) {
  const index = argumentsList.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = argumentsList[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a directory path.`);
  }
  return value;
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const supportedArguments = new Set(["--source", "--output"]);
  for (let index = 0; index < argumentsList.length; index += 2) {
    if (!supportedArguments.has(argumentsList[index])) {
      throw new Error(`Unknown argument: ${argumentsList[index] ?? ""}`);
    }
  }

  const manifest = await minifyJavaScriptTree({
    sourceDirectory: optionValue(
      argumentsList,
      "--source",
      DEFAULT_SOURCE_DIRECTORY,
    ),
    outputDirectory: optionValue(
      argumentsList,
      "--output",
      DEFAULT_OUTPUT_DIRECTORY,
    ),
  });

  console.log(
    `Minified ${manifest.fileCount} JavaScript files: `
      + `${manifest.sourceBytes} -> ${manifest.outputBytes} bytes `
      + `(${manifest.reductionPercent}% smaller).`,
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
