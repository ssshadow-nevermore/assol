import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(join(process.cwd(), "drizzle", "0003_masters.sql"), "utf8");

test("masters migration preserves the five public cards and their editable copy", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(migration);
  const rows = database.prepare("SELECT id, name, specialization, services_text, is_active, sort_order FROM masters ORDER BY sort_order").all().map((row) => ({ ...row }));
  assert.deepEqual(rows, [
    { id: "dzhulia", name: "Джулия", specialization: "Парикмахер-универсал", services_text: "Стрижки · окрашивание любой сложности · брови", is_active: 1, sort_order: 0 },
    { id: "marina", name: "Марина", specialization: "Мастер депиляции", services_text: "Депиляция лица и тела", is_active: 1, sort_order: 1 },
    { id: "snezhana", name: "Снежана", specialization: "Парикмахер-универсал", services_text: "Стрижки · окрашивание · химия", is_active: 1, sort_order: 2 },
    { id: "yulia", name: "Юлия", specialization: "Парикмахер-универсал, колорист", services_text: "Стрижки · окрашивание любой сложности", is_active: 1, sort_order: 3 },
    { id: "elena", name: "Елена", specialization: "Мастер ногтевого сервиса", services_text: "Маникюр · педикюр · покрытие", is_active: 1, sort_order: 4 },
  ]);
  database.close();
});

test("masters migration is idempotent for seeded ids", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(migration);
  database.exec(migration);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM masters").get().count, 5);
  database.close();
});
