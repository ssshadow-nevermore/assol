/**
 * Platform-independent authentication core for the two fixed administrators.
 *
 * This module deliberately knows nothing about a particular host, database,
 * proxy, or rate-limit product. Callers provide an AdminSessionStore.
 */

export type AdminAccountId = "owner" | "developer";

export type AdminIdentity = {
  accountId: AdminAccountId | "local-development";
  login?: string;
};

export type AccessCheck =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; response: Response };

type AdminAccount = {
  id: AdminAccountId;
  login: string;
  verifier: ParsedVerifier;
};

type ParsedVerifier = {
  iterations: number;
  salt: Uint8Array;
  digest: Uint8Array;
};

type SessionRow = {
  token_hash: string;
  account_id: string;
  created_at: string;
  expires_at: string;
};

export type AdminSessionRecord = SessionRow;

export interface AdminSessionStore {
  purgeExpired(beforeIso: string): Promise<void>;
  insert(record: SessionRow): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
}

export interface AdminRateLimiter {
  consume(key: string): Promise<boolean>;
}

export type AdminAuthRuntime = {
  ADMIN_DEV_BYPASS?: string;
  ADMIN_OWNER_LOGIN?: string;
  ADMIN_OWNER_PASSWORD_VERIFIER?: string;
  ADMIN_DEVELOPER_LOGIN?: string;
  ADMIN_DEVELOPER_PASSWORD_VERIFIER?: string;
  AUTH_PASSWORD_PEPPER?: string;
  sessionStore?: AdminSessionStore;
  rateLimiter?: AdminRateLimiter;
};

const PBKDF2_ALGORITHM = "SHA-256";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_COOKIE = "__Host-admin_session";
const DEV_SESSION_COOKIE = "admin_session_dev";
const VERIFIER_PREFIX = "pbkdf2_sha256";
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 2_000_000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 5;
const MAX_LOGIN_BUCKETS = 4096;

const loginAttempts = new Map<string, { count: number; windowStartedAt: number }>();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(normalized);
    return new Uint8Array(Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function parseVerifier(encoded: string): ParsedVerifier | null {
  const parts = encoded.trim().split("$");
  if (parts.length !== 4 || parts[0] !== VERIFIER_PREFIX) return null;
  const iterations = Number(parts[1]);
  const salt = base64UrlDecode(parts[2]);
  const digest = base64UrlDecode(parts[3]);
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) return null;
  if (!salt || salt.byteLength < 16 || !digest || digest.byteLength !== 32) return null;
  return { iterations, salt, digest };
}

function configuredAccounts(env: Partial<AdminAuthRuntime> | undefined): AdminAccount[] | null {
  const pepper = String(env?.AUTH_PASSWORD_PEPPER ?? "");
  const ownerLogin = String(env?.ADMIN_OWNER_LOGIN ?? "").trim();
  const developerLogin = String(env?.ADMIN_DEVELOPER_LOGIN ?? "").trim();
  const ownerVerifier = parseVerifier(String(env?.ADMIN_OWNER_PASSWORD_VERIFIER ?? ""));
  const developerVerifier = parseVerifier(String(env?.ADMIN_DEVELOPER_PASSWORD_VERIFIER ?? ""));
  if (!pepper || !ownerLogin || !developerLogin || ownerLogin.toLowerCase() === developerLogin.toLowerCase() || !ownerVerifier || !developerVerifier) return null;
  return [
    { id: "owner", login: ownerLogin, verifier: ownerVerifier },
    { id: "developer", login: developerLogin, verifier: developerVerifier },
  ];
}

export function hasConfiguredAdminSecrets(env: Partial<AdminAuthRuntime> | undefined): boolean {
  return configuredAccounts(env) !== null;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.byteLength ^ right.byteLength;
  const length = Math.max(left.byteLength, right.byteLength);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index % Math.max(left.byteLength, 1)] ?? 0) ^ (right[index % Math.max(right.byteLength, 1)] ?? 0);
  }
  return difference === 0;
}

async function passwordMaterial(password: string, pepper: string): Promise<Uint8Array> {
  const value = textBytes(`${password}\u0000${pepper}`);
  // Keep derivation input bounded while preserving distinct values for long
  // passwords. The digest is only used for unusually large input and is not
  // exposed to callers.
  if (value.byteLength <= 4096) return value;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", asArrayBuffer(value)));
}

async function derivePasswordDigest(password: string, pepper: string, verifier: ParsedVerifier): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", asArrayBuffer(await passwordMaterial(password, pepper)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: PBKDF2_ALGORITHM, salt: asArrayBuffer(verifier.salt), iterations: verifier.iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Verify either fixed account without exposing whether the login exists. */
export async function verifyAdminCredentials(login: string, password: string, env: Partial<AdminAuthRuntime> | undefined): Promise<AdminIdentity | null> {
  const accounts = configuredAccounts(env);
  if (!accounts) return null;
  const normalizedLogin = login.trim().toLowerCase();
  const selected = accounts.find((account) => account.login.toLowerCase() === normalizedLogin);
  // Always derive against both fixed accounts. Unknown logins therefore take
  // the same PBKDF2 work as known logins and cannot be cheaply enumerated by
  // timing the account lookup.
  const derived = await Promise.all(accounts.map((account) => derivePasswordDigest(password, String(env?.AUTH_PASSWORD_PEPPER ?? ""), account.verifier)));
  const matched = accounts.map((account, index) => constantTimeEqual(derived[index], account.verifier.digest));
  if (!selected || !matched[accounts.indexOf(selected)]) return null;
  return { accountId: selected.id, login: selected.login };
}

function isPrivateLanIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return false;
  return octets[0] === 10
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
}

export function isLocalDevelopmentHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1"
    || isPrivateLanIpv4(normalized);
}

export function isNodeDevelopmentRuntime(): boolean {
  if (typeof process === "undefined" || process.release?.name !== "node") return false;
  // An explicit production mode always wins. This prevents a PM2/systemd
  // argument containing the word "dev" from accidentally enabling the LAN
  // bypass in a production Node process.
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NODE_ENV === "development" || (process.env.NODE_ENV == null && process.argv.includes("dev"));
}

function localDevelopmentRequest(request: Request, env: Partial<AdminAuthRuntime> | undefined): boolean {
  const hostname = new URL(request.url).hostname;
  return isNodeDevelopmentRuntime()
    && String(env?.ADMIN_DEV_BYPASS ?? "").trim().toLowerCase() === "true"
    && isLocalDevelopmentHostname(hostname);
}

function unauthorizedResponse(message = "Требуется авторизация", status: 401 | 403 | 429 | 503): Response {
  return Response.json({ error: message }, {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 401 ? { "WWW-Authenticate": "Session" } : {}),
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    });
}

function unauthorized(message = "Требуется авторизация", status: 401 | 403 | 429 | 503 = 401): AccessCheck {
  return { ok: false, response: unauthorizedResponse(message, status) };
}

function cookieName(request: Request): string {
  const hostname = new URL(request.url).hostname;
  return isNodeDevelopmentRuntime() && isLocalDevelopmentHostname(hostname) ? DEV_SESSION_COOKIE : SESSION_COOKIE;
}

export function getSessionCookieName(request: Request): string {
  return cookieName(request);
}

function cookieValue(request: Request): string | null {
  const expectedName = cookieName(request);
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name === expectedName && /^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  }
  return null;
}

async function tokenHash(token: string): Promise<string> {
  return base64UrlEncode(new Uint8Array(await crypto.subtle.digest("SHA-256", asArrayBuffer(textBytes(token)))));
}

function safeAccountId(value: string): AdminAccountId | null {
  return value === "owner" || value === "developer" ? value : null;
}

function sessionCookie(request: Request, token: string, maxAgeSeconds: number): string {
  const local = cookieName(request) === DEV_SESSION_COOKIE;
  return `${cookieName(request)}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Strict${local ? "" : "; Secure"}`;
}

export function clearSessionCookie(request: Request): string {
  return `${cookieName(request)}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${cookieName(request) === DEV_SESSION_COOKIE ? "" : "; Secure"}`;
}

function requestClientKey(request: Request, login: string): string {
  // Do not trust arbitrary forwarding headers. The Node adapter can replace
  // this bounded process-local key with the verified peer address once a
  // trusted reverse proxy is configured.
  return `node-process:${login.trim().toLowerCase().slice(0, 128)}`;
}

async function consumeLoginRateLimit(request: Request, env: Partial<AdminAuthRuntime>, login: string): Promise<boolean> {
  const key = requestClientKey(request, login);
  const limiter = env.rateLimiter;
  if (limiter && typeof limiter.consume === "function") {
    try {
      return await limiter.consume(key);
    } catch {
      // A broken external limiter falls back to the bounded process-local
      // window. It never creates an allow path without a limit.
    }
  }
  const now = Date.now();
  // Keep the portable in-process limiter bounded when an attacker sprays
  // unique login names. Expired buckets are discarded first; if the cap is
  // still reached, evict one oldest entry rather than growing unbounded.
  if (!loginAttempts.has(key) && loginAttempts.size >= MAX_LOGIN_BUCKETS) {
    for (const [bucketKey, bucket] of loginAttempts) {
      if (now - bucket.windowStartedAt >= LOGIN_WINDOW_MS) loginAttempts.delete(bucketKey);
    }
    if (loginAttempts.size >= MAX_LOGIN_BUCKETS) {
      const oldestKey = loginAttempts.keys().next().value;
      if (typeof oldestKey === "string") loginAttempts.delete(oldestKey);
    }
  }
  const current = loginAttempts.get(key);
  if (!current || now - current.windowStartedAt >= LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStartedAt: now });
    return true;
  }
  if (current.count >= LOGIN_ATTEMPT_LIMIT) return false;
  current.count += 1;
  return true;
}

function resetLocalLoginRateLimit(request: Request, login: string): void {
  loginAttempts.delete(requestClientKey(request, login));
}

export function isSameOriginRequest(request: Request): boolean {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;
  const referer = request.headers.get("referer");
  if (referer) {
    try { return new URL(referer).origin === expectedOrigin; } catch { return false; }
  }
  return false;
}

export async function createAdminSession(request: Request, identity: AdminIdentity, env: Partial<AdminAuthRuntime> | undefined): Promise<Response> {
  const store = env?.sessionStore;
  if (!store || (identity.accountId !== "owner" && identity.accountId !== "developer")) {
    return Response.json({ error: "Авторизация временно недоступна" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = base64UrlEncode(tokenBytes);
  const hash = await tokenHash(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  await store.purgeExpired(now.toISOString());
  await store.insert({ token_hash: hash, account_id: identity.accountId, created_at: now.toISOString(), expires_at: expiresAt });
  return Response.json({ ok: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": sessionCookie(request, token, Math.floor(SESSION_TTL_MS / 1000)),
    },
  });
}

export async function invalidateAdminSession(request: Request, env?: Partial<AdminAuthRuntime>): Promise<void> {
  const token = cookieValue(request);
  if (!token) return;
  const store = env?.sessionStore;
  if (!store) return;
  await store.deleteByTokenHash(await tokenHash(token));
}

export async function requireAdminSession(request: Request, suppliedEnv?: Partial<AdminAuthRuntime>): Promise<AccessCheck> {
  const env = suppliedEnv;
  if (localDevelopmentRequest(request, env)) {
    return { ok: true, identity: { accountId: "local-development" } };
  }
  const token = cookieValue(request);
  if (!token) return unauthorized();
  const store = env?.sessionStore;
  if (!store) return unauthorized("Авторизация временно недоступна", 503);
  try {
    const session = await store.findByTokenHash(await tokenHash(token));
    const accountId = session ? safeAccountId(session.account_id) : null;
    if (!session || !accountId || !session.expires_at || Date.parse(session.expires_at) <= Date.now()) {
      if (session) await store.deleteByTokenHash(session.token_hash);
      return unauthorized();
    }
    return { ok: true, identity: { accountId } };
  } catch (error) {
    console.error(JSON.stringify({ message: "Admin session lookup failed", error: error instanceof Error ? error.message : String(error) }));
    return unauthorized("Авторизация временно недоступна", 503);
  }
}

/** Compatibility export retained for existing route callers. */
export async function checkAdminAccess(request: Request, suppliedEnv?: Partial<AdminAuthRuntime>): Promise<AccessCheck> {
  return requireAdminSession(request, suppliedEnv);
}

export async function authenticateLogin(request: Request, login: string, password: string, suppliedEnv?: Partial<AdminAuthRuntime>): Promise<Response> {
  const env = suppliedEnv;
  if (!env || !hasConfiguredAdminSecrets(env)) return unauthorizedResponse("Авторизация временно недоступна", 503);
  if (!(await consumeLoginRateLimit(request, env, login))) return unauthorizedResponse("Слишком много попыток. Попробуйте позже.", 429);
  const identity = await verifyAdminCredentials(login, password, env);
  if (!identity) return unauthorizedResponse("Неверный логин или пароль", 401);
  resetLocalLoginRateLimit(request, login);
  return createAdminSession(request, identity, env);
}

export async function assertAdminSession(request: Request, suppliedEnv?: Partial<AdminAuthRuntime>): Promise<AdminIdentity> {
  const result = await requireAdminSession(request, suppliedEnv);
  if (!result.ok) throw new Error("ADMIN_AUTH_REQUIRED");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !isSameOriginRequest(request)) throw new Error("ADMIN_CSRF_REJECTED");
  return result.identity;
}
