import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { closeSqliteDatabase, getSqliteDatabase } from "../db/sqlite.ts";
import { updateResource } from "../app/api/admin/admin-api.ts";

test("pure service sort_order patch skips unrelated legacy duration validation and preserves other columns", async () => {
  const previousSqlitePath = process.env.SQLITE_PATH;
  const temporaryRoot = mkdtempSync(join(tmpdir(), "assol-admin-api-"));
  process.env.SQLITE_PATH = join(temporaryRoot, "admin-api.sqlite");
  closeSqliteDatabase();

  try {
    const database = getSqliteDatabase();
    const service = database.prepare("SELECT * FROM services ORDER BY sort_order, id LIMIT 1").get();
    assert.ok(service);
    const serviceId = String(service.id);
    const otherService = database.prepare("SELECT * FROM services WHERE category_id <> ? ORDER BY sort_order, id LIMIT 1").bind(service.category_id).get();
    assert.ok(otherService);

    database.prepare("UPDATE services SET duration_min_minutes = 0, duration_max_minutes = NULL, duration_text = ? WHERE id = ?")
      .bind("legacy duration", serviceId).run();
    const before = database.prepare("SELECT category_id, name, pricing_type, price_amount, price_min, price_max, price_tiers_json, duration_text, duration_min_minutes, duration_max_minutes, sort_order FROM services WHERE id = ?")
      .bind(serviceId).get();
    const otherBefore = database.prepare("SELECT category_id, sort_order FROM services WHERE id = ?").bind(otherService.id).get();

    await assert.rejects(
      updateResource("services", serviceId, { duration_min_minutes: 0 }),
      /Длительность услуги.*от 1 до 1440 минут/,
    );

    const reordered = await updateResource("services", serviceId, { sort_order: 5 });
    assert.equal(reordered.sort_order, 5);
    const after = database.prepare("SELECT category_id, name, pricing_type, price_amount, price_min, price_max, price_tiers_json, duration_text, duration_min_minutes, duration_max_minutes, sort_order FROM services WHERE id = ?")
      .bind(serviceId).get();
    assert.deepEqual({ ...after, sort_order: before.sort_order }, { ...before });
    assert.equal(after.sort_order, 5);
    assert.deepEqual(database.prepare("SELECT category_id, sort_order FROM services WHERE id = ?").bind(otherService.id).get(), otherBefore);

    await assert.rejects(
      updateResource("services", serviceId, { duration_min_minutes: 1441 }),
      /Длительность услуги.*от 1 до 1440 минут/,
    );

    const validUpdate = await updateResource("services", serviceId, { duration_min_minutes: 45, duration_max_minutes: 60 });
    assert.equal(validUpdate.duration_min_minutes, 45);
    assert.equal(validUpdate.duration_max_minutes, 60);

    const sortOrderBeforeMixedPatch = database.prepare("SELECT sort_order FROM services WHERE id = ?").bind(serviceId).get();
    await assert.rejects(
      updateResource("services", serviceId, { sort_order: 6, duration_min_minutes: 0 }),
      /Длительность услуги.*от 1 до 1440 минут/,
    );
    assert.deepEqual(database.prepare("SELECT sort_order FROM services WHERE id = ?").bind(serviceId).get(), sortOrderBeforeMixedPatch);

    for (const resource of ["service_categories", "working_hours", "external_links", "portfolio_items", "offers", "offer_conditions", "offer_service_rules", "masters"]) {
      const row = database.prepare(`SELECT id, sort_order FROM ${resource} ORDER BY sort_order, id LIMIT 1`).get();
      assert.ok(row, `${resource} should have a sortable row`);
      const nextSortOrder = Number(row.sort_order) + 1;
      const updated = await updateResource(resource, String(row.id), { sort_order: nextSortOrder });
      assert.equal(updated.sort_order, nextSortOrder, `${resource} sort_order should update through the narrow path`);
      assert.equal(updated.id, row.id, `${resource} id should remain unchanged`);
    }
  } finally {
    closeSqliteDatabase();
    if (previousSqlitePath === undefined) delete process.env.SQLITE_PATH;
    else process.env.SQLITE_PATH = previousSqlitePath;
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
