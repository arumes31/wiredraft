import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

if (existsSync(".env")) process.loadEnvFile(".env");

const executable = process.platform === "win32" ? "go.exe" : "go";
const child = spawn(executable, ["run", "./cmd/server", "-port", "41817"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    PGHOST: process.env.PGHOST || "127.0.0.1",
    PGPORT: process.env.PGPORT || "5432",
    PGDATABASE: process.env.PGDATABASE || "wiredraft",
    PGUSER: process.env.PGUSER || "wiredraft",
    PGPASSWORD: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "wiredraft-playwright",
    PGSSLMODE: process.env.PGSSLMODE || "disable",
    WIREDRAFT_ADMIN_USER: "playwright-admin",
    WIREDRAFT_ADMIN_PASSWORD: "playwright-only-long-password",
    WIREDRAFT_GUEST_ENABLED: "true",
  },
});

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(signal));
child.on("exit", (code) => {
  process.exitCode = stopping ? 0 : code ?? 1;
});
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
