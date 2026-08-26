import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const migrationsDirectory = join(projectRoot, "drizzle");
const migrationFiles = readdirSync(migrationsDirectory).filter((file) =>
  /^0000_.+\.sql$/.test(file),
);

assert.equal(
  migrationFiles.length,
  1,
  "The first D1 stage must contain exactly one 0000 migration",
);

const migrationSql = readFileSync(
  join(migrationsDirectory, migrationFiles[0]),
  "utf8",
);

function createMigratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(`PRAGMA foreign_keys = ON;\n${migrationSql}`);
  return database;
}

test("first D1 migration creates the nine approved tables", () => {
  const database = createMigratedDatabase();
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map(({ name }) => name);

  assert.deepEqual(tables, [
    "external_links",
    "offer_conditions",
    "offer_service_rules",
    "offers",
    "portfolio_items",
    "salon_settings",
    "service_categories",
    "services",
    "working_hours",
  ]);
  database.close();
});

test("certificate offer links to its sellable service and keeps structured mechanics", () => {
  const database = createMigratedDatabase();

  database
    .prepare(
      `INSERT INTO service_categories
        (id, legacy_id, number, title, short_title)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run("certificate-category", "certificate", "10", "Сертификат", "Сертификат");

  const insertService = database.prepare(
    `INSERT INTO services
      (id, category_id, legacy_id, name, pricing_type, price_amount)
     VALUES (?, ?, ?, ?, 'fixed', ?)`,
  );
  insertService.run(
    "certificate-service",
    "certificate-category",
    "certificate-1000",
    "Скидочный сертификат",
    1000,
  );
  insertService.run(
    "qualifying-service",
    "certificate-category",
    "qualifying-service",
    "Подходящая услуга",
    3501,
  );

  database
    .prepare(
      `INSERT INTO offers
        (id, linked_service_id, type, slug, title, description, benefit_type,
         benefit_value, nominal_value, is_transferable, status)
       VALUES (?, ?, 'certificate', ?, ?, ?, 'nominal', NULL, 1000, 1, 'active')`,
    )
    .run(
      "certificate-offer",
      "certificate-service",
      "discount-certificate",
      "Скидочный сертификат",
      "Покупается за 1 000 ₽ или выдаётся бесплатно по условию.",
    );

  database
    .prepare(
      `INSERT INTO offer_conditions
        (id, offer_id, condition_type, operator, amount_value, description)
       VALUES (?, ?, 'minimum_single_service_price', 'gt', 3000, ?)`,
    )
    .run(
      "certificate-free-condition",
      "certificate-offer",
      "Бесплатно при покупке одной услуги стоимостью строго больше 3 000 ₽.",
    );

  database
    .prepare(
      `INSERT INTO offer_service_rules
        (id, offer_id, service_id, rule_type, discount_amount, usage_limit)
       VALUES (?, ?, ?, 'fixed_discount', 200, 1)`,
    )
    .run(
      "certificate-discount-rule",
      "certificate-offer",
      "qualifying-service",
    );

  const certificate = database
    .prepare(
      `SELECT o.linked_service_id, o.nominal_value, o.benefit_value,
              s.price_amount AS purchase_price,
              c.condition_type, c.operator, c.amount_value
       FROM offers o
       JOIN services s ON s.id = o.linked_service_id
       JOIN offer_conditions c ON c.offer_id = o.id
       WHERE o.id = ?`,
    )
    .get("certificate-offer");

  assert.deepEqual({ ...certificate }, {
    linked_service_id: "certificate-service",
    nominal_value: 1000,
    benefit_value: null,
    purchase_price: 1000,
    condition_type: "minimum_single_service_price",
    operator: "gt",
    amount_value: 3000,
  });

  assert.throws(() => {
    database
      .prepare(
        `INSERT INTO offers
          (id, linked_service_id, type, slug, title, description, benefit_type,
           benefit_value, nominal_value)
         VALUES (?, ?, 'certificate', ?, ?, ?, 'nominal', 1000, 1000)`,
      )
      .run(
        "invalid-nominal-offer",
        "certificate-service",
        "invalid-nominal",
        "Некорректный номинал",
        "Номинал не должен дублироваться.",
      );
  }, /offers_nominal_value_check/);

  assert.throws(() => {
    database
      .prepare(
        `INSERT INTO offers
          (id, linked_service_id, type, slug, title, description, benefit_type)
         VALUES (?, ?, 'certificate', ?, ?, ?, 'custom')`,
      )
      .run(
        "missing-service-offer",
        "missing-service",
        "missing-service",
        "Некорректная связь",
        "Связанная услуга должна существовать.",
      );
  }, /FOREIGN KEY constraint failed/);

  database.close();
});
