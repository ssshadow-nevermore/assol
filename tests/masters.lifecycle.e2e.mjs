import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("dialog", (dialog) => dialog.accept());
const names = { a: "QA Master A", b: "QA Master B", c: "QA Master C" };

async function openAdmin() {
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
}

async function createMaster(name, specialization = "Парикмахер", services = "Стрижки") {
  await openAdmin();
  await page.locator("#admin-masters button").filter({ hasText: /добавить мастера/i }).first().click();
  const modal = page.locator('[role="dialog"]');
  const inputs = modal.locator("input");
  await inputs.nth(0).fill(name);
  await inputs.nth(1).fill(specialization);
  await modal.locator("textarea").fill(services);
  await modal.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.waitForSelector(`.admin-master-card:has-text("${name}")`);
}

async function row(name) {
  const response = await page.request.get(`${base}/api/admin?resource=masters`);
  assert.equal(response.status(), 200);
  return (await response.json()).items.find((item) => item.name === name);
}

async function card(name) {
  return page.locator(".admin-master-card").filter({ hasText: name }).first();
}

await createMaster(names.a);
await createMaster(names.b);

await openAdmin();
let aCard = await card(names.a);
await aCard.getByRole("button", { name: "Изменить", exact: true }).click();
let modal = page.locator('[role="dialog"]');
await modal.locator("input").nth(1).fill("Парикмахер-универсал");
await modal.locator("textarea").fill("Стрижки · окрашивание · брови");
await modal.getByRole("button", { name: "Сохранить", exact: true }).click();
assert.equal((await row(names.a)).services_text, "Стрижки · окрашивание · брови");

await openAdmin();
await (await card(names.b)).getByRole("button", { name: "Скрыть", exact: true }).click();
await page.getByText("Скрыто", { exact: true }).waitFor();
await page.goto(base, { waitUntil: "networkidle" });
assert.equal(await page.locator(".team-grid").getByText(names.b, { exact: true }).count(), 0, "hidden B is absent from public");

await openAdmin();
const showHidden = page.getByRole("button", { name: /Показывать скрытые/i });
if (await showHidden.count()) await showHidden.click();
await (await card(names.b)).getByRole("button", { name: "Показать", exact: true }).click();
await page.getByText("Показано", { exact: true }).waitFor();
await page.goto(base, { waitUntil: "networkidle" });
assert.equal(await page.locator(".team-grid").getByText(names.b, { exact: true }).count(), 1, "restored B is public");

await createMaster(names.c, "Очень длинная специализация мастера для проверки адаптивной верстки", "Стрижки · окрашивание любой сложности · брови · укладки · уход за волосами · длинный текст");
for (const width of [320, 375, 390, 430]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.evaluate(() => window.innerWidth), width);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `public master layout has no horizontal overflow at ${width}`);
  assert.equal(await page.locator(".team-grid").getByText(names.c, { exact: true }).count(), 1);
  await openAdmin();
  assert.equal(await page.evaluate(() => window.innerWidth), width);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `admin has no horizontal overflow at ${width}`);
  const cCard = await card(names.c);
  await cCard.getByRole("button", { name: "Изменить", exact: true }).click();
  modal = page.locator('[role="dialog"]');
  const box = await modal.boundingBox();
  assert.ok(box && box.width <= width, `master editor fits ${width}px`);
  await modal.getByRole("button", { name: "Отмена", exact: true }).click();
}

// Exercise the zero-active edge with the same admin API used by the UI. This
// keeps the test deterministic while the UI hide/restore path is exercised by
// B above; every existing row is restored before the test exits.
await page.setViewportSize({ width: 1280, height: 900 });
const seeded = (await (await page.request.get(`${base}/api/admin?resource=masters`)).json()).items;
for (const item of seeded) await page.request.fetch(`${base}/api/admin?resource=masters&id=${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, data: { is_active: 0 } });
await page.goto(base, { waitUntil: "networkidle" });
assert.equal(await page.locator(".team-grid > article").count(), 0, "zero active masters keeps public block intact");
for (const item of seeded) await page.request.fetch(`${base}/api/admin?resource=masters&id=${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, data: { is_active: 1 } });

for (const name of [names.a, names.b, names.c]) {
  await openAdmin();
  const target = await card(name);
  await target.getByRole("button", { name: "Удалить", exact: true }).click();
  await page.getByText("Запись удалена", { exact: true }).waitFor();
  assert.equal((await row(name)), undefined, `${name} cleanup`);
}
console.log("masters lifecycle E2E: A/B edit hide restore, C long-text mobile 320/375/390/430, zero-active, cleanup PASS");
await browser.close();
