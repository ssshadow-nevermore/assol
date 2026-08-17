import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the salon landing page with its primary sections", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Ассоль — салон красоты в Пушкино/);
  assert.match(html, /Красота, в которой/);
  assert.match(html, /Все услуги/);
  assert.match(html, /Результат говорит/);
  assert.match(html, /Московский проспект, 44/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|Building your site/i);
});

test("renders the booking route without VK handoff copy", async () => {
  const response = await render("/booking");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Выберите время/);
  assert.match(html, /Отправить заявку/);
  assert.match(html, /Переходить на другой сайт не потребуется/);
  assert.doesNotMatch(html, /переходите в сообщения|Текст заявки для VK/i);
});

test("all image references exist and legacy text-overlay assets are removed", async () => {
  const [page, booking, imageFiles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/booking/page.tsx", import.meta.url), "utf8"),
    readdir(new URL("../public/images/", import.meta.url)),
  ]);
  const sources = [...page.matchAll(/src=["']\/images\/([^"']+)/g), ...booking.matchAll(/src:\s*["']\/images\/([^"']+)/g)].map((match) => match[1]);

  assert.ok(sources.length >= 10);
  for (const source of sources) await access(new URL(`../public/images/${source}`, import.meta.url));

  const legacyAssets = ["gallery-9.webp", "gallery-10.webp", "gallery-5.webp", "gallery-4.webp", "photo-2.webp", "booking-color.jpg", "booking-women.jpg", "booking-men.jpg", "booking-children.jpg"];
  for (const asset of legacyAssets) assert.equal(imageFiles.includes(asset), false, `${asset} must not be published`);
});

test("booking submission has validation, timeout, recipient and success/error states", async () => {
  const booking = await readFile(new URL("../app/booking/page.tsx", import.meta.url), "utf8");
  assert.match(booking, /https:\/\/api\.web3forms\.com\/submit/);
  assert.match(booking, /jokerz44677@gmail\.com/);
  assert.match(booking, /AbortController/);
  assert.match(booking, /phoneDigits\.length >= 10/);
  assert.match(booking, /submitState === "success"/);
  assert.match(booking, /submitState === "error"/);
});
