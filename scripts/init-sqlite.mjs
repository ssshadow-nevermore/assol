import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const configured = process.env.SQLITE_PATH || process.env.DATABASE_PATH || ".data/site.sqlite";
const filePath = resolve(root, configured);
mkdirSync(dirname(filePath), { recursive: true });
const database = new DatabaseSync(filePath);
database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
database.exec("CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");

for (const name of ["0000_nice_sleeper.sql", "0001_add_offer_flip_enabled.sql", "0002_editable_site_blocks.sql", "0003_masters.sql", "0004_admin_sessions.sql"]) {
  const file = join(root, "drizzle", name);
  if (!existsSync(file)) throw new Error(`Missing migration ${file}`);
  const applied = database.prepare("SELECT 1 FROM _app_migrations WHERE name = ? LIMIT 1").get(name);
  if (applied) continue;
  database.exec("BEGIN");
  try {
    database.exec(readFileSync(file, "utf8"));
    database.prepare("INSERT INTO _app_migrations (name) VALUES (?)").run(name);
    database.exec("COMMIT");
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch { /* preserve original error */ }
    throw error;
  }
}

const existing = database.prepare("SELECT COUNT(*) AS count FROM salon_settings").get();
if (Number(existing?.count ?? 0) === 0) {
  database.exec(readFileSync(join(root, "drizzle", "seeds", "0001_current_site_content.sql"), "utf8"));
}
database.close();
console.log(`SQLite ready: ${filePath}`);
