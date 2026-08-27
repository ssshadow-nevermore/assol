#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = resolve(projectRoot, ".env.local");
const serverFile = resolve(projectRoot, "dist", "standalone", "server.js");

function fail(message) {
  console.error(`[start:local-prod] ${message}`);
  return 1;
}

async function main() {
  if (!existsSync(envFile)) return fail(".env.local was not found");
  if (!existsSync(serverFile)) return fail("dist/standalone/server.js was not found; run pnpm build first");

  try {
    // Node's dotenv parser treats quoted values and literal `$` characters
    // correctly. No shell or interpolation is involved.
    process.loadEnvFile(envFile);
  } catch {
    // Keep parser errors from echoing a line that may contain a secret.
    return fail("could not load .env.local");
  }

  // This command is only a local launcher for the production build. Keep the
  // child in production mode so production auth and cookie guards stay active.
  const child = spawn(process.execPath, [serverFile, ...process.argv.slice(2)], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "production" },
    shell: false,
    stdio: "inherit",
  });

  const signalHandlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const handler = () => {
      if (!child.killed) child.kill(signal);
    };
    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }

  return await new Promise((finish) => {
    const cleanup = () => {
      for (const [signal, handler] of signalHandlers) process.off(signal, handler);
    };
    child.once("error", () => {
      cleanup();
      finish(fail("could not start dist/standalone/server.js"));
    });
    child.once("exit", (code) => {
      cleanup();
      finish(code ?? 1);
    });
  });
}

process.exitCode = await main();
