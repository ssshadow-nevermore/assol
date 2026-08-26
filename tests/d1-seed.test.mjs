import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const migrationSql = readFileSync(join(projectRoot, "drizzle", "0000_nice_sleeper.sql"), "utf8");
const seedSql = readFileSync(join(projectRoot, "drizzle", "seeds", "0001_current_site_content.sql"), "utf8");

const expectedCounts = {
  service_categories: 10,
  services: 84,
  salon_settings: 1,
  working_hours: 7,
  external_links: 11,
  portfolio_items: 3,
  offers: 2,
  offer_conditions: 11,
  offer_service_rules: 43,
};

function createSeededDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(`PRAGMA foreign_keys = ON;\n${migrationSql}`);
  database.exec(seedSql);
  return database;
}

test("current-site seed writes the planned records and is idempotent", () => {
  const database = createSeededDatabase();
  database.exec(seedSql);
  for (const [table, expected] of Object.entries(expectedCounts)) {
    const { count } = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
    assert.equal(count, expected, table);
  }
  database.close();
});

test("seed references are valid and deterministic identifiers remain unique", () => {
  const database = createSeededDatabase();
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM (SELECT id FROM services GROUP BY id HAVING COUNT(*) > 1)").get().count, 0);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM (SELECT category_id, legacy_id FROM services GROUP BY category_id, legacy_id HAVING COUNT(*) > 1)").get().count, 0);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM (SELECT slug FROM offers GROUP BY slug HAVING COUNT(*) > 1)").get().count, 0);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM (SELECT link_key FROM external_links GROUP BY link_key HAVING COUNT(*) > 1)").get().count, 0);
  database.close();
});

test("certificate stays a 1000-ruble service and an offer with the strict free condition", () => {
  const database = createSeededDatabase();
  const row = database.prepare(`
    SELECT s.id AS service_id, s.price_amount, o.id AS offer_id, o.linked_service_id,
           o.benefit_type, o.nominal_value, o.benefit_value,
           c.condition_type, c.operator, c.amount_value
    FROM services s
    JOIN offers o ON o.linked_service_id = s.id
    JOIN offer_conditions c ON c.offer_id = o.id
      AND c.condition_type = 'minimum_single_service_price'
    WHERE s.id = 'service:certificate:discount-card'
  `).get();
  assert.deepEqual({ ...row }, {
    service_id: "service:certificate:discount-card",
    price_amount: 1000,
    offer_id: "offer:discount-certificate",
    linked_service_id: "service:certificate:discount-card",
    benefit_type: "nominal",
    nominal_value: 1000,
    benefit_value: null,
    condition_type: "minimum_single_service_price",
    operator: "gt",
    amount_value: 3000,
  });
  database.close();
});

test("legacy loyalty and certificate flags become offer service rules", () => {
  const database = createSeededDatabase();
  const counts = database.prepare(`
    SELECT offer_id, rule_type, COUNT(*) AS count
    FROM offer_service_rules
    GROUP BY offer_id, rule_type
    ORDER BY offer_id
  `).all().map((row) => ({ ...row }));
  assert.deepEqual(counts, [
    { offer_id: "offer:discount-certificate", rule_type: "fixed_discount", count: 39 },
    { offer_id: "offer:loyalty-sixth-haircut", rule_type: "free_nth_visit", count: 4 },
  ]);
  const sharedNailRules = database.prepare("SELECT COUNT(*) AS count FROM offer_service_rules WHERE shared_usage_group = 'nail-care-200'").get().count;
  assert.equal(sharedNailRules, 8);
  database.close();
});
