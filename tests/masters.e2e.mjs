import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3000";
const name = "QA E2E Master";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
page.on("dialog", (dialog) => dialog.accept());

async function adminRows() {
  const response = await page.request.get(`${base}/api/admin?resource=masters`);
  assert.equal(response.status(), 200);
  return (await response.json()).items;
}

const mediaResponse = await page.request.post(`${base}/api/admin/media?resource=masters`);
assert.equal(mediaResponse.status(), 400, "master media API is disabled");

async function openMaster(nameToEdit = name) {
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  const card = page.locator(".admin-master-card").filter({ hasText: nameToEdit }).first();
  await card.getByRole("button", { name: "Изменить", exact: true }).click();
  return page.locator('[role="dialog"]');
}

async function saveNewMaster() {
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await page.locator("#admin-masters button").filter({ hasText: /добавить мастера/i }).first().click();
  const modal = page.locator('[role="dialog"]');
  const inputs = modal.locator("input");
  await inputs.nth(0).fill(name);
  await inputs.nth(1).fill("Парикмахер-универсал QA");
  await modal.locator("textarea").fill("Стрижки · окрашивание · тестовый мастер");
  assert.equal(await modal.locator("input[type=file]").count(), 0, "master editor does not expose a photo input");
  assert.equal(await modal.getByText(/Фото мастера|Загрузить фото|Удалить фото/).count(), 0, "master editor does not expose photo controls");
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/admin?resource=masters") && response.request().method() === "POST"),
    modal.getByRole("button", { name: "Сохранить", exact: true }).click(),
  ]);
  await page.waitForSelector(`.admin-master-card:has-text("${name}")`);
}

await saveNewMaster();
let rows = await adminRows();
let row = rows.find((item) => item.name === name);
assert.ok(row, "new master exists in D1 API");
assert.equal(row.image_storage_key ?? null, null, "new masters are not assigned media keys");

let modal = await openMaster();
assert.equal(await modal.locator("input[type=file]").count(), 0, "existing master editor does not expose a photo input");
await page.goto(base, { waitUntil: "networkidle" });
assert.equal(await page.locator(".team-grid").getByText(name, { exact: true }).count(), 1, "new master is rendered on public page");

await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
modal = await openMaster();
await modal.locator("input").nth(1).fill("Обновлённая специализация");
await modal.locator("textarea").fill("Новый список услуг");
await modal.getByRole("button", { name: "Сохранить", exact: true }).click();
await page.getByText("Сохранено", { exact: true }).waitFor();
row = (await adminRows()).find((item) => item.name === name);
assert.equal(row.specialization, "Обновлённая специализация");
assert.equal(row.services_text, "Новый список услуг");

await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
const card = page.locator(".admin-master-card").filter({ hasText: name }).first();
await card.getByRole("button", { name: "Удалить", exact: true }).click();
await page.getByText("Запись удалена", { exact: true }).waitFor();
assert.equal((await adminRows()).some((item) => item.name === name), false, "temporary master is removed");
assert.deepEqual(errors, [], "master E2E has no browser errors");
console.log("masters E2E: create/edit/public/refresh/delete and no-photo UI PASS");
await browser.close();
