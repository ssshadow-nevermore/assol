#!/usr/bin/env node

// Generate a PBKDF2-HMAC-SHA256 verifier locally. The password is read from
// stdin and is never written to disk, command-line arguments, or logs.
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output, stderr as errorOutput } from "node:process";

const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const DIGEST_BYTES = 32;

function encode(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function readPassword() {
  if (input.isTTY && typeof input.setRawMode === "function") {
    errorOutput.write("Password: ");
    input.setRawMode(true);
    input.resume();
    return await new Promise((resolve, reject) => {
      let value = "";
      const onData = (chunk) => {
        const text = chunk.toString();
        for (const character of text) {
          if (character === "\u0003") {
            cleanup();
            reject(new Error("Cancelled"));
            return;
          }
          if (character === "\r" || character === "\n") {
            cleanup();
            errorOutput.write("\n");
            resolve(value);
            return;
          }
          if (character === "\u007f" || character === "\b") {
            value = value.slice(0, -1);
          } else {
            value += character;
          }
        }
      };
      const cleanup = () => {
        input.off("data", onData);
        input.setRawMode(false);
        input.pause();
      };
      input.on("data", onData);
    });
  }
  const rl = createInterface({ input, output: errorOutput });
  try {
    return await rl.question("Password: ");
  } finally {
    rl.close();
  }
}

try {
  const password = await readPassword();
  if (!password) throw new Error("Password must not be empty");
  const pepper = process.env.AUTH_PASSWORD_PEPPER ?? "";
  if (!pepper) throw new Error("Set AUTH_PASSWORD_PEPPER in the local environment before generating a verifier");
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const material = new TextEncoder().encode(`${password}\u0000${pepper}`);
  const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
  const digest = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    DIGEST_BYTES * 8,
  ));
  // This is the only emitted secret-derived value. Do not add diagnostic
  // output here: the command is intended to be pasted into a secret store.
  output.write(`pbkdf2_sha256$${ITERATIONS}$${encode(salt)}$${encode(digest)}\n`);
} catch (error) {
  errorOutput.write(`${error instanceof Error ? error.message : "Unable to generate verifier"}\n`);
  process.exitCode = 1;
}
