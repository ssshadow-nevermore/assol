import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import ts from "typescript";

const DIKIDI_URL = "https://dikidi.net/#widget=215695";
const DIKIDI_SCRIPT_URL = "https://dikidi.net/assets/js/widget_record/widget2.min.js?v=1773811740";

let serverProcess;
let serverBase;
let serverReady;

async function ensureServer() {
  if (serverReady) return serverReady;
  serverReady = (async () => {
    const port = 31000 + (process.pid % 1000);
    serverBase = `http://127.0.0.1:${port}`;
    serverProcess = spawn(process.execPath, ["dist/standalone/server.js"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port) },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const started = Date.now();
    while (Date.now() - started < 15_000) {
      try {
        const response = await fetch(`${serverBase}/`, { redirect: "manual" });
        if (response.status >= 200 && response.status < 500) return;
      } catch {
        // The standalone server needs a short warm-up after the child starts.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("VINEXT standalone server did not become ready");
  })();
  return serverReady;
}

after(async () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});

async function render(pathname = "/") {
  await ensureServer();
  return fetch(`${serverBase}${pathname}`, { headers: { accept: "text/html" }, redirect: "manual" });
}

async function loadTypeScriptModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(output)}`);
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
  assert.match(html, /Каждая шестая/);
  assert.match(html, /Получите бесплатно/);
  assert.match(html, /Хорошее место/);
  assert.match(html, /maps-reviews-widget\/1089857323\?comments/);
  assert.match(html, /1 200 \/ 1 500 \/ 1 800 ₽/);
  // The public copy is editable in D1 (the seeded row currently uses
  // “шестая стрижка бесплатно”), so assert the business meaning rather than
  // one particular punctuation/capitalisation variant.
  assert.match(html, /(?:6-я|шестая)[^<]{0,80}бесплатн/i);
  assert.match(html, /assol\.beautysalon@yandex\.ru/);
  assert.match(html, />MAX</);
  assert.doesNotMatch(html, /WhatsApp|Telegram|wa\.me|telegram\.me/i);
  assert.ok(html.includes(DIKIDI_URL));
  assert.ok(html.includes(DIKIDI_SCRIPT_URL.replaceAll("&", "&amp;")) || html.includes(DIKIDI_SCRIPT_URL));
  assert.match(html, /<script[^>]+widget2\.min\.js[^>]+defer/i);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|\/api\/booking/i);
});

test("legacy booking route redirects to DIKIDI", async () => {
  const response = await render("/booking");
  assert.ok([301, 302, 303, 307, 308].includes(response.status));
  assert.equal(response.headers.get("location"), DIKIDI_URL);
});

test("all visible image references exist and legacy assets stay removed", async () => {
  const [page, fallbackData, imageFiles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/site-data-fallback.ts", import.meta.url), "utf8"),
    readdir(new URL("../public/images/", import.meta.url)),
  ]);
  const sources = [...page.matchAll(/src=["']\/images\/([^"']+)/g), ...fallbackData.matchAll(/["']\/images\/([^"']+)/g)].map((match) => match[1]);

  assert.ok(sources.length >= 5);
  for (const source of sources) await access(new URL(`../public/images/${source}`, import.meta.url));

  const legacyAssets = ["gallery-9.webp", "gallery-10.webp", "gallery-5.webp", "gallery-4.webp", "photo-2.webp", "booking-color.jpg", "booking-women.jpg", "booking-men.jpg", "booking-children.jpg"];
  for (const asset of legacyAssets) assert.equal(imageFiles.includes(asset), false, `${asset} must not be published`);
  await access(new URL("../public/media/good-place-2026.mp4", import.meta.url));
  await access(new URL("../public/media/good-place-2026-safari.mp4", import.meta.url));
});

test("custom booking form and email endpoint are removed", async () => {
  const [page, portfolio, redirectPage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PortfolioCarousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/booking/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(page.includes("getSiteData"));
  assert.ok(portfolio.includes("bookingUrl"));
  assert.match(redirectPage, /redirect\(siteData\.links\.dikidi_widget\.url\)/);
  await assert.rejects(access(new URL("../app/api/booking/route.ts", import.meta.url)));
  await assert.rejects(access(new URL("../app/booking/booking-message.mjs", import.meta.url)));
});

test("certificate prices are calculated for ranges, from-prices and zero results", async () => {
  const { applyDiscountToPriceLabel } = await loadTypeScriptModule("../app/price-utils.ts");

  assert.equal(applyDiscountToPriceLabel("2 000 / 2 500 / 3 000 ₽", 200), "1 800 / 2 300 / 2 800 ₽");
  assert.equal(applyDiscountToPriceLabel("от 400 ₽", 200), "от 200 ₽");
  assert.equal(applyDiscountToPriceLabel("200 ₽", 200), "бесплатно");
  assert.equal(applyDiscountToPriceLabel("150 ₽", 200), "бесплатно");
  assert.equal(applyDiscountToPriceLabel("по договорённости", 200), "по договорённости");
  assert.equal(applyDiscountToPriceLabel("1 000 ₽", 0), "1 000 ₽");
});

test("structured service prices are the public source of truth", async () => {
  const { formatStoredPrice } = await loadTypeScriptModule("../app/price-utils.ts");

  assert.equal(formatStoredPrice({ pricing_type: "fixed", price_amount: 1500, price_display_text: null }), "1 500 ₽");
  assert.equal(formatStoredPrice({ pricing_type: "from", price_amount: 2200, price_display_text: "Цена по запросу" }), "от 2 200 ₽");
  assert.equal(formatStoredPrice({ pricing_type: "range", price_min: 1000, price_max: 2000, price_display_text: null }), "1 000–2 000 ₽");
  assert.equal(formatStoredPrice({ pricing_type: "tiers", price_tiers_json: JSON.stringify([{ label: "Короткие", amount: 1000 }, { label: "Средние", amount: 1500 }, { label: "Длинные", amount: 2000 }]), price_display_text: "1 000 / 1 500 / 2 000 ₽" }), "1 000 / 1 500 / 2 000 ₽");
  assert.equal(formatStoredPrice({ pricing_type: "tiers", price_tiers_json: JSON.stringify([{ label: "Короткие", amount: 1000 }, { label: "Длинные", amount: 2000 }]), price_display_text: "1 000 / 1 500 / 2 000 ₽" }), "1 000 / 2 000 ₽");
  assert.equal(formatStoredPrice({ pricing_type: "free", price_amount: 0, price_display_text: null }), "Бесплатно");
  assert.equal(formatStoredPrice({ pricing_type: "custom", price_display_text: "По договорённости" }), "По договорённости");
  assert.equal(formatStoredPrice({ pricing_type: "fixed", price_amount: null, price_display_text: null }), "Цена по запросу");
});

test("category headline price is the minimum numeric active service price", async () => {
  const { formatCategoryPriceFromServices, getMinimumNumericPrice } = await loadTypeScriptModule("../app/price-utils.ts");
  const tiers = { pricing_type: "tiers", price_tiers_json: JSON.stringify([{ label: "A", amount: 900 }, { label: "B", amount: 1200 }]) };
  assert.equal(getMinimumNumericPrice({ pricing_type: "fixed", price_amount: 500 }), 500);
  assert.equal(getMinimumNumericPrice(tiers), 900);
  assert.equal(formatCategoryPriceFromServices({}, [{ pricing_type: "custom", price_display_text: "Цена по запросу" }, { pricing_type: "fixed", price_amount: 900 }, tiers]), "от 900 ₽");
  assert.equal(formatCategoryPriceFromServices({}, [{ pricing_type: "custom", price_display_text: "Цена по запросу" }]), "Цена по запросу");
  assert.equal(formatCategoryPriceFromServices({}, []), "Цена по запросу");
});

test("public service loader selects structured prices and does not fall back for an empty category", async () => {
  const source = await readFile(new URL("../app/site-data.ts", import.meta.url), "utf8");
  assert.match(source, /pricing_type, price_amount, price_min, price_max, price_tiers_json/);
  assert.match(source, /price: formatStoredPrice\(service\)/);
  assert.doesNotMatch(source, /categoryRows\.length === 0 \|\| serviceRows\.length === 0/);
});

test("video media route preserves byte ranges for WebKit playback", async () => {
  const [route, video] = await Promise.all([
    readFile(new URL("../app/media/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardVideo.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /accept-ranges/);
  assert.match(route, /content-range/);
  assert.match(route, /status: 206/);
  assert.match(video, /playsInline/);
  assert.match(video, /muted/);
  assert.match(video, /controls/);
  assert.match(video, /good-place-2026-safari/);
  assert.match(video, /onError/);
});

test("manicure and pedicure discounts only appear on services named accordingly", async () => {
  const { catalogCategories } = await loadTypeScriptModule("../app/services-data.ts");

  for (const categoryId of ["manicure", "pedicure"]) {
    const category = catalogCategories.find(({ id }) => id === categoryId);
    assert.ok(category, `${categoryId} category must exist`);

    for (const item of category.items) {
      const namedForCategory = item.name.toLocaleLowerCase("ru-RU").includes(categoryId === "manicure" ? "маникюр" : "педикюр");
      assert.equal(Boolean(item.certificateDiscount), namedForCategory, `${item.name} has an incorrect certificate badge`);
    }
  }
});
