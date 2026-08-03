import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const dataDir = mkdtempSync(join(tmpdir(), "netdiagram-playwright-"));
const executable = process.platform === "win32" ? "go.exe" : "go";
const child = spawn(executable, ["run", "./cmd/server", "-port", "41817", "-data-dir", dataDir], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  windowsHide: true,
});

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(signal));
child.on("exit", (code) => {
  rmSync(dataDir, { recursive: true, force: true });
  process.exitCode = stopping ? 0 : code ?? 1;
});
child.on("error", (error) => {
  console.error(error);
  rmSync(dataDir, { recursive: true, force: true });
  process.exitCode = 1;
});
