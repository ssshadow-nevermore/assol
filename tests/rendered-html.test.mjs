import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const DIKIDI_URL = "https://dikidi.net/#widget=215695";
const DIKIDI_SCRIPT_URL = "https://dikidi.net/assets/js/widget_record/widget2.min.js?v=1773811740";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" }, redirect: "manual" }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the salon landing page with DIKIDI booking links", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Ассоль — салон красоты в Пушкино/);
  assert.match(html, /Красота, в которой/);
  assert.match(html, /Все услуги/);
  assert.match(html, /Результат говорит/);
  assert.match(html, /Московский проспект, 44/);
  assert.ok(html.includes(DIKIDI_URL));
  assert.ok(html.includes(DIKIDI_SCRIPT_URL.replaceAll("&", "&amp;")) || html.includes(DIKIDI_SCRIPT_URL));
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|\/api\/booking/i);
});

test("legacy booking route redirects to DIKIDI", async () => {
  const response = await render("/booking");
  assert.ok([301, 302, 303, 307, 308].includes(response.status));
  assert.equal(response.headers.get("location"), DIKIDI_URL);
});

test("all visible image references exist and legacy assets stay removed", async () => {
  const [page, portfolio, imageFiles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PortfolioCarousel.tsx", import.meta.url), "utf8"),
    readdir(new URL("../public/images/", import.meta.url)),
  ]);
  const sources = [...page.matchAll(/src=["']\/images\/([^"']+)/g), ...portfolio.matchAll(/src:\s*["']\/images\/([^"']+)/g)].map((match) => match[1]);

  assert.ok(sources.length >= 5);
  for (const source of sources) await access(new URL(`../public/images/${source}`, import.meta.url));

  const legacyAssets = ["gallery-9.webp", "gallery-10.webp", "gallery-5.webp", "gallery-4.webp", "photo-2.webp", "booking-color.jpg", "booking-women.jpg", "booking-men.jpg", "booking-children.jpg"];
  for (const asset of legacyAssets) assert.equal(imageFiles.includes(asset), false, `${asset} must not be published`);
});

test("custom booking form and email endpoint are removed", async () => {
  const [page, portfolio, redirectPage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PortfolioCarousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/booking/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(page.includes("DIKIDI_URL"));
  assert.ok(portfolio.includes("DIKIDI_URL"));
  assert.match(redirectPage, /redirect\(DIKIDI_URL\)/);
  await assert.rejects(access(new URL("../app/api/booking/route.ts", import.meta.url)));
  await assert.rejects(access(new URL("../app/booking/booking-message.mjs", import.meta.url)));
});
