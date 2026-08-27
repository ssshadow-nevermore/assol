import assert from "node:assert/strict";
import test from "node:test";

const storage = await import("../app/api/admin/yandex-storage.ts");
const mediaUrl = await import("../app/media-url.ts");
const env = {
  YC_ACCESS_KEY_ID: "testing-access-key",
  YC_SECRET_ACCESS_KEY: "testing-secret-key",
  YC_BUCKET_NAME: "assol-site-media",
};
const key = "media/portfolio_items/portfolio-1/01234567-89ab-cdef-0123-456789abcdef.webp";

test("S3 Signature V4 request is generated without exposing credentials", async () => {
  const request = await storage.createYandexS3Request(env, "PUT", key, new TextEncoder().encode("image").buffer, "image/webp", new Date("2024-01-02T03:04:05.000Z"));
  assert.equal(request.method, "PUT");
  assert.equal(request.url, `https://storage.yandexcloud.net/${env.YC_BUCKET_NAME}/${key}`);
  assert.match(request.headers.get("authorization") ?? "", /^AWS4-HMAC-SHA256 Credential=testing-access-key\/20240102\/ru-central1\/s3\/aws4_request/);
  assert.equal(request.headers.get("x-amz-date"), "20240102T030405Z");
  assert.equal(request.headers.get("x-amz-content-sha256"), "6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d");
  assert.equal((await request.text()), "image");
  assert.doesNotMatch(request.headers.get("authorization") ?? "", /testing-secret-key/);
});

test("storage keys and missing credentials are rejected", async () => {
  assert.equal(storage.isSafeStorageKey(key), true);
  assert.equal(storage.isSafeStorageKey("media/../secret.txt"), false);
  await assert.rejects(() => storage.createYandexS3Request({ YC_BUCKET_NAME: env.YC_BUCKET_NAME }, "GET", key, undefined, "application/octet-stream"), /credentials are not configured/);
});

test("public media URL prefers legacy images and resolves managed storage keys", () => {
  assert.equal(mediaUrl.resolveMediaUrl("/images/portfolio-color-refresh.webp", null), "/images/portfolio-color-refresh.webp");
  assert.equal(mediaUrl.resolveMediaUrl(null, "media/portfolio_items/portfolio-color-refresh/example.webp"), "/media/media/portfolio_items/portfolio-color-refresh/example.webp");
  assert.equal(mediaUrl.resolveMediaUrl("", "media/portfolio_items/portfolio-color-refresh/example.webp"), "/media/media/portfolio_items/portfolio-color-refresh/example.webp");
});

test("put, read and delete use signed server-side requests", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (request) => {
    requests.push(request);
    return new Response(null, { status: request.method === "GET" ? 200 : request.method === "DELETE" ? 204 : 200 });
  };
  try {
    await storage.putYandexObject(env, key, new TextEncoder().encode("image").buffer, "image/webp");
    const read = await storage.getYandexObject(env, key);
    await storage.deleteYandexObject(env, key);
    assert.equal(read.status, 200);
    assert.deepEqual(requests.map((request) => request.method), ["PUT", "GET", "DELETE"]);
    assert.ok(requests.every((request) => request.headers.has("authorization")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("read aborts stalled storage requests instead of hanging forever", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_request, init) => new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  try {
    await assert.rejects(() => storage.getYandexObject(env, key, 5), /read request failed: aborted/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
