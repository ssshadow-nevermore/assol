import assert from "node:assert/strict";
import test from "node:test";

const client = await import("../app/admin/media-client.ts");

test("client normalizes a JPEG selected from Photos with a HEIC MIME", async () => {
  const source = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "IMG_OLD.HEIC", { type: "image/heic", lastModified: 123 });
  const normalized = await client.prepareImageFile(source);
  assert.equal(normalized.type, "image/jpeg");
  assert.equal(normalized.name, "upload.jpg");
  assert.equal(normalized.lastModified, 123);
});

test("client normalizes an empty MIME using image magic bytes", async () => {
  const source = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "asset", { type: "" });
  const normalized = await client.prepareImageFile(source);
  assert.equal(normalized.type, "image/png");
  assert.equal(normalized.name, "upload.png");
});

test("client fails a raw HEIC in non-browser runtimes instead of hanging", async () => {
  const heic = new File([new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])], "IMG.HEIC", { type: "image/heic" });
  await assert.rejects(() => client.prepareImageFile(heic), /HEIC\/HEIF/);
});

test("client bounds a stalled File.arrayBuffer call", async () => {
  const stalled = {
    size: 4,
    type: "image/jpeg",
    lastModified: Date.now(),
    async arrayBuffer() {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
    },
  };
  await assert.rejects(() => client.prepareImageFile(stalled, { readTimeoutMs: 5 }), /прочитать изображение вовремя/);
});
