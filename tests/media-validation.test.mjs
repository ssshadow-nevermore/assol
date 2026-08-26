import assert from "node:assert/strict";
import test from "node:test";

const validation = await import("../app/api/admin/media-validation.ts");
const mediaKey = await import("../app/api/admin/media-key.ts");

test("media API rejects non-whitelisted MIME types before storage access", async () => {
  await assert.rejects(() => validation.validateImageFile(new File(["not an image"], "note.txt", { type: "text/plain" })), /JPEG, PNG и WebP/);
});

test("media API rejects files larger than 8 MB before storage access", async () => {
  await assert.rejects(() => validation.validateImageFile(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })), /8 МБ/);
});

test("media API rejects unsafe record ids", async () => {
  assert.throws(() => validation.assertSafeRecordId("../secret"), /Некорректный id/);
  assert.equal(validation.assertSafeRecordId("portfolio:color-refresh"), "portfolio:color-refresh");
});

test("portfolio ids are separated from safe Yandex storage path segments", () => {
  const key = mediaKey.mediaStorageKey("portfolio_items", "portfolio:color-refresh", "webp");
  assert.match(key, /^media\/portfolio_items\/portfolio-color-refresh\/[a-f0-9-]+\.webp$/);
});

test("media API verifies image magic bytes and accepts a valid PNG", async () => {
  await assert.rejects(() => validation.validateImageFile(new File(["not png"], "fake.png", { type: "image/png" })), /содержимому изображения/);
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const validated = await validation.validateImageFile(new File([pngHeader], "valid.png", { type: "image/png" }));
  assert.equal(validated.contentType, "image/png");
  assert.equal(validated.extension, "png");
});

test("media API uses detected bytes instead of a Photos MIME/extension mismatch", async () => {
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const validated = await validation.validateImageFile(new File([jpegHeader], "IMG_OLD.HEIC", { type: "image/heic" }));
  assert.equal(validated.contentType, "image/jpeg");
  assert.equal(validated.extension, "jpg");
});

test("media API accepts an empty browser MIME when the bytes identify a safe image", async () => {
  const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const validated = await validation.validateImageFile(new File([webpHeader], "asset", { type: "" }));
  assert.equal(validated.contentType, "image/webp");
  assert.equal(validated.extension, "webp");
});

test("raw HEIC is rejected server-side with a conversion instruction", async () => {
  const heicHeader = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  await assert.rejects(() => validation.validateImageFile(new File([heicHeader], "IMG_OLD.HEIC", { type: "image/heic" })), /HEIC\/HEIF/);
});
