import test from "node:test";
import assert from "node:assert/strict";
import {
  checkAdminAccess,
  createAdminSession,
  invalidateAdminSession,
  isLocalDevelopmentHostname,
  isSameOriginRequest,
  requireAdminSession,
  verifyAdminCredentials,
} from "../app/api/admin/access.ts";

// These tests model the VINEXT dev runtime; production must never inherit the
// explicit local bypass, even when an attacker supplies forwarding headers.
process.env.NODE_ENV = "development";

const testPassword = String.fromCharCode(81, 65, 45, 55, 51, 57, 50, 53, 49, 33);
const testPepper = String.fromCharCode(108, 111, 99, 97, 108, 45, 112, 101, 112, 112, 101, 114);

function encode(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function verifier(password, pepper) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const material = new TextEncoder().encode(`${password}\u0000${pepper}`);
  const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
  const digest = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256));
  return `pbkdf2_sha256$100000$${encode(salt)}$${encode(digest)}`;
}

const devEnv = { ADMIN_DEV_BYPASS: "true" };

test("DEV bypass accepts loopback and private LAN hosts only", async () => {
  for (const hostname of ["localhost", "127.0.0.1", "192.168.1.50", "10.0.0.8", "172.16.4.2", "172.31.255.254"]) {
    assert.equal(isLocalDevelopmentHostname(hostname), true, hostname);
    const result = await checkAdminAccess(new Request(`http://${hostname}/admin`), devEnv);
    assert.equal(result.ok, true, hostname);
  }
});

test("DEV bypass rejects public hostnames and spoofed forwarding headers", async () => {
  for (const url of ["https://site-creator-vinext-starter.assolbeauty.workers.dev/admin", "https://assolbeauty.ru/admin"]) {
    const result = await checkAdminAccess(new Request(url, { headers: { "x-forwarded-host": "192.168.1.50" } }), devEnv);
    assert.equal(result.ok, false, url);
    if (!result.ok) assert.equal(result.response.status, 401);
  }
});

test("false or missing DEV flag keeps normal session enforcement on LAN", async () => {
  for (const env of [{ ...devEnv, ADMIN_DEV_BYPASS: "false" }, { ...devEnv, ADMIN_DEV_BYPASS: "" }, { ...devEnv, ADMIN_DEV_BYPASS: undefined }]) {
    const result = await checkAdminAccess(new Request("http://192.168.1.50/api/admin"), env);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, 401);
  }
});

test("production Node runtime never honors the DEV bypass", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const result = await checkAdminAccess(new Request("http://192.168.1.50/api/admin"), devEnv);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, 401);
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test("fixed owner and developer credentials verify with PBKDF2 and wrong logins do not", async () => {
  const env = {
    ADMIN_OWNER_LOGIN: "owner-test",
    ADMIN_OWNER_PASSWORD_VERIFIER: await verifier(testPassword, testPepper),
    ADMIN_DEVELOPER_LOGIN: "developer-test",
    ADMIN_DEVELOPER_PASSWORD_VERIFIER: await verifier(testPassword, testPepper),
    AUTH_PASSWORD_PEPPER: testPepper,
  };
  assert.equal((await verifyAdminCredentials("owner-test", testPassword, env))?.accountId, "owner");
  assert.equal((await verifyAdminCredentials("developer-test", testPassword, env))?.accountId, "developer");
  assert.equal(await verifyAdminCredentials("owner-test", `${testPassword}x`, env), null);
  assert.equal(await verifyAdminCredentials("unknown", testPassword, env), null);
  assert.equal(await verifyAdminCredentials("owner-test", testPassword, { ...env, AUTH_PASSWORD_PEPPER: "" }), null);
});

test("state-changing requests require same origin", () => {
  assert.equal(isSameOriginRequest(new Request("https://example.test/api/admin", { method: "POST", headers: { Origin: "https://example.test" } })), true);
  assert.equal(isSameOriginRequest(new Request("https://example.test/api/admin", { method: "POST", headers: { Origin: "https://evil.test" } })), false);
  assert.equal(isSameOriginRequest(new Request("https://example.test/api/admin", { method: "POST", headers: { Referer: "https://example.test/admin" } })), true);
  assert.equal(isSameOriginRequest(new Request("https://example.test/api/admin", { method: "POST" })), false);
});

function mockDatabase() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              if (sql.startsWith("INSERT INTO admin_sessions")) rows.push({ token_hash: values[0], account_id: values[1], created_at: values[2], expires_at: values[3] });
              if (sql.startsWith("DELETE FROM admin_sessions WHERE token_hash")) {
                const index = rows.findIndex((row) => row.token_hash === values[0]);
                if (index >= 0) rows.splice(index, 1);
              }
              return { success: true };
            },
            async all() {
              if (sql.startsWith("SELECT token_hash")) return { results: rows.filter((row) => row.token_hash === values[0]) };
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

function sessionStoreFromDatabase(database) {
  return {
    purgeExpired: async () => {},
    insert: async (record) => {
      await database.prepare("INSERT INTO admin_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
        .bind(record.token_hash, record.account_id, record.created_at, record.expires_at).run();
    },
    findByTokenHash: async (hash) => {
      const result = await database.prepare("SELECT token_hash, account_id, created_at, expires_at FROM admin_sessions WHERE token_hash = ? LIMIT 1").bind(hash).all();
      return result.results[0] ?? null;
    },
    deleteByTokenHash: async (hash) => {
      await database.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(hash).run();
    },
  };
}

test("sessions persist only a token hash and logout invalidates it", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const database = mockDatabase();
    const sessionStore = sessionStoreFromDatabase(database);
    const request = new Request("https://admin.example.test/admin");
    const response = await createAdminSession(request, { accountId: "owner" }, { sessionStore });
    assert.equal(response.status, 200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    const token = setCookie.match(/__Host-admin_session=([A-Za-z0-9_-]{43})/)?.[1];
    assert.ok(token);
    assert.equal(setCookie.includes("HttpOnly"), true);
    assert.equal(setCookie.includes("Secure"), true);
    assert.equal(database.rows.length, 1);
    assert.notEqual(database.rows[0].token_hash, token);
    assert.match(database.rows[0].token_hash, /^[A-Za-z0-9_-]{43}$/);
    const authenticatedRequest = new Request("https://admin.example.test/admin", { headers: { Cookie: `__Host-admin_session=${token}` } });
    assert.equal((await requireAdminSession(authenticatedRequest, { sessionStore })).ok, true);
    await invalidateAdminSession(authenticatedRequest, { sessionStore });
    assert.equal((await requireAdminSession(authenticatedRequest, { sessionStore })).ok, false);
    assert.equal(database.rows.length, 0);
  } finally {
    process.env.NODE_ENV = previous;
  }
});
