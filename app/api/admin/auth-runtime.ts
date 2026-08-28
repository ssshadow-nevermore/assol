/**
 * Node runtime adapter for the platform-independent auth core.
 * Auth semantics live in `access.ts`; this module only supplies environment
 * values and a SQLite session store so a future database can be swapped in
 * without changing routes or authentication rules.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSqliteDatabase } from "../../../db/sqlite";
import type { AdminAuthRuntime, AdminSessionRecord, AdminSessionStore } from "./access";

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}

function localEnvironment(): Record<string, string> {
  if (process.env.NODE_ENV === "production") return {};
  const root = process.cwd();
  return {
    ...parseEnvFile(resolve(root, ".env.local")),
    ...parseEnvFile(resolve(root, ".dev.vars")),
  };
}

function sqliteStore(): AdminSessionStore {
  const database = getSqliteDatabase();
  return {
    async purgeExpired(beforeIso) {
      database.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(beforeIso).run();
    },
    async insert(record: AdminSessionRecord) {
      database.prepare("INSERT INTO admin_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
        .bind(record.token_hash, record.account_id, record.created_at, record.expires_at).run();
    },
    async findByTokenHash(hash) {
      return database.prepare("SELECT token_hash, account_id, created_at, expires_at FROM admin_sessions WHERE token_hash = ? LIMIT 1")
        .bind(hash).get<AdminSessionRecord>();
    },
    async deleteByTokenHash(hash) {
      database.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(hash).run();
    },
  };
}

function fromEnv(source: Record<string, string>): Partial<AdminAuthRuntime> {
  return {
    ADMIN_DEV_BYPASS: source.ADMIN_DEV_BYPASS,
    ADMIN_PUBLIC_ORIGIN: source.ADMIN_PUBLIC_ORIGIN,
    ADMIN_OWNER_LOGIN: source.ADMIN_OWNER_LOGIN,
    ADMIN_OWNER_PASSWORD_VERIFIER: source.ADMIN_OWNER_PASSWORD_VERIFIER,
    ADMIN_DEVELOPER_LOGIN: source.ADMIN_DEVELOPER_LOGIN,
    ADMIN_DEVELOPER_PASSWORD_VERIFIER: source.ADMIN_DEVELOPER_PASSWORD_VERIFIER,
    AUTH_PASSWORD_PEPPER: source.AUTH_PASSWORD_PEPPER,
    sessionStore: sqliteStore(),
  };
}

/** Server-only environment used by media and other route adapters. */
export async function runtimeEnv(): Promise<Partial<Env>> {
  const local = localEnvironment();
  // VINEXT/Vite may preload .env.local into process.env through dotenv-expand.
  // PBKDF2 verifiers contain literal `$` separators, so the preloaded value
  // can be altered before it reaches the application. Prefer our exact local
  // file parser in development; in production localEnvironment() is empty and
  // process.env remains the sole source.
  return { ...(process.env as Record<string, string>), ...local } as Partial<Env>;
}

export function authRuntimeFromEnv(source: Partial<Env> | undefined): Partial<AdminAuthRuntime> {
  return fromEnv({ ...(source as Record<string, string> | undefined), ...localEnvironment() });
}

export async function getAuthRuntime(): Promise<Partial<AdminAuthRuntime>> {
  const runtime = await runtimeEnv();
  return fromEnv(runtime as Record<string, string>);
}
