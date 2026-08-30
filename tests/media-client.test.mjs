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

test("client accepts legacy JPEG extensions when Android supplies an empty MIME", async () => {
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  for (const name of ["old-photo.jpg", "old-photo.jpeg"]) {
    const normalized = await client.prepareImageFile(new File([jpegHeader], name, { type: "" }));
    assert.equal(normalized.type, "image/jpeg");
    assert.equal(normalized.name, "upload.jpg");
  }
});

test("client normalizes a JPEG reported with the legacy image/jpg MIME", async () => {
  const normalized = await client.prepareImageFile(new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "old-photo.jpg", { type: "image/jpg" }));
  assert.equal(normalized.type, "image/jpeg");
  assert.equal(normalized.name, "upload.jpg");
});

test("client detects HEIC and HEIF containers even when their MIME is empty", async () => {
  const heicBytes = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  const heifBytes = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31]);
  const heicImageSequenceBytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x6d, 0, 0, 0, 0, 0x6d, 0x69, 0x66, 0x31]);
  const heicStillImageBytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x73, 0, 0, 0, 0, 0x6d, 0x69, 0x66, 0x31]);
  assert.equal(client.detectImageType(heicBytes), "image/heic");
  assert.equal(client.detectImageType(heifBytes), "image/heif");
  assert.equal(client.detectImageType(heicImageSequenceBytes), "image/heif");
  assert.equal(client.detectImageType(heicStillImageBytes), "image/heif");
  await assert.rejects(() => client.prepareImageFile(new File([heicBytes], "old-photo.heic", { type: "" })), /HEIC\/HEIF/);
  await assert.rejects(() => client.prepareImageFile(new File([heifBytes], "old-photo.heif", { type: "" })), /HEIC\/HEIF/);
});

test("regression: AVIF compatible with mif1 must not be classified as HEIF", () => {
  const avif = new Uint8Array([
    0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70,
    0x6d, 0x69, 0x66, 0x31, 0, 0, 0, 0,
    0x61, 0x76, 0x69, 0x66,
  ]);
  assert.equal(client.detectImageType(avif), "image/avif");
});

test("client distinguishes AVIF brands and unknown ISO-BMFF containers", async () => {
  const avif = new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
  const avis = new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x73]);
  const unknown = new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
  assert.equal(client.detectImageType(avif), "image/avif");
  assert.equal(client.detectImageType(avis), "image/avif");
  assert.equal(client.detectImageType(unknown), null);
  await assert.rejects(() => client.prepareImageFile(new File([avif], "old-photo.avif", { type: "" })), /AVIF/);
});

test("client trusts image signatures over declared MIME and filename", async () => {
  const heic = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  await assert.rejects(() => client.prepareImageFile(new File([heic], "old-photo.jpg", { type: "image/jpeg" })), /HEIC\/HEIF/);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const normalized = await client.prepareImageFile(new File([jpeg], "old-photo.heic", { type: "image/heic" }));
  assert.equal(normalized.type, "image/jpeg");
});

test("client keeps the decoder failure specific and records safe local diagnostics", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCreateImageBitmap = globalThis.createImageBitmap;
  const previousDebug = console.debug;
  const diagnostics = [];
  const fakeImage = {
    decoding: "",
    naturalWidth: 0,
    naturalHeight: 0,
    addEventListener(event, handler) {
      if (event === "error") queueMicrotask(handler);
    },
    src: "",
  };
  try {
    globalThis.window = { location: { hostname: "localhost" } };
    globalThis.document = { createElement() { return fakeImage; } };
    globalThis.createImageBitmap = async () => { throw new Error("native decoder does not support this HEIC variant"); };
    console.debug = (...args) => diagnostics.push(args);
    const heic = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    await assert.rejects(() => client.prepareImageFile(new File([heic], "old-photo.heic", { type: "" })), /Не удалось декодировать изображение HEIC\/HEIF/);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0][1].detectedType, "image/heic");
    assert.equal(diagnostics[0][1].name, "old-photo.heic");
  } finally {
    console.debug = previousDebug;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = previousCreateImageBitmap;
  }
});

test("client rejects an unsupported empty-MIME document with a user-facing image error", async () => {
  const pdf = new File(["%PDF-1.7"], "document.pdf", { type: "" });
  await assert.rejects(() => client.prepareImageFile(pdf), /Тип файла не соответствует содержимому изображения/);
});

test("client accepts images below and at 15 MB and rejects larger files", async () => {
  const maxBytes = 15 * 1024 * 1024;
  assert.equal(client.CLIENT_MAX_IMAGE_BYTES, maxBytes);
  const jpeg = (size) => {
    const bytes = new Uint8Array(size);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    return new File([bytes], "photo.jpg", { type: "" });
  };
  assert.equal((await client.prepareImageFile(jpeg(maxBytes - 1))).type, "image/jpeg");
  assert.equal((await client.prepareImageFile(jpeg(maxBytes))).type, "image/jpeg");
  await assert.rejects(() => client.prepareImageFile(jpeg(maxBytes + 1)), /Максимальный размер изображения — 15 МБ/);
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
