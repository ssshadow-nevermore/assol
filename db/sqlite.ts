import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";

type SqlValue = string | number | bigint | Uint8Array | null | undefined;

export type SqlitePrepared = {
  bind(...values: SqlValue[]): SqlitePrepared;
  all<T extends Record<string, unknown> = Record<string, unknown>>(): { results: T[] };
  get<T extends Record<string, unknown> = Record<string, unknown>>(): T | null;
  run(): { changes: number; lastInsertRowid: number | bigint };
};

export type SqliteDatabase = {
  prepare(sql: string): SqlitePrepared;
  batch(statements: SqlitePrepared[]): void;
  exec(sql: string): void;
  close(): void;
};

function normalizeValues(values: SqlValue[]): (string | number | bigint | Uint8Array | null)[] {
  return values.map((value) => value === undefined ? null : value);
}

class PreparedStatement implements SqlitePrepared {
  private values: SqlValue[] = [];

  constructor(private readonly database: DatabaseSync, private readonly sql: string) {}

  bind(...values: SqlValue[]): SqlitePrepared {
    this.values = values;
    return this;
  }

  all<T extends Record<string, unknown> = Record<string, unknown>>(): { results: T[] } {
    return { results: this.database.prepare(this.sql).all(...normalizeValues(this.values)) as T[] };
  }

  get<T extends Record<string, unknown> = Record<string, unknown>>(): T | null {
    return (this.database.prepare(this.sql).get(...normalizeValues(this.values)) as T | undefined) ?? null;
  }

  run(): { changes: number; lastInsertRowid: number | bigint } {
    const result = this.database.prepare(this.sql).run(...normalizeValues(this.values));
    return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
  }
}

class NodeSqliteDatabase implements SqliteDatabase {
  constructor(private readonly database: DatabaseSync) {}

  prepare(sql: string): SqlitePrepared {
    return new PreparedStatement(this.database, sql);
  }

  batch(statements: SqlitePrepared[]): void {
    this.database.exec("BEGIN");
    try {
      for (const statement of statements) statement.run();
      this.database.exec("COMMIT");
    } catch (error) {
      try { this.database.exec("ROLLBACK"); } catch { /* preserve original error */ }
      throw error;
    }
  }

  exec(sql: string): void { this.database.exec(sql); }
  close(): void { this.database.close(); }
}

function migrationFiles(root: string): string[] {
  return ["0000_nice_sleeper.sql", "0001_add_offer_flip_enabled.sql", "0002_editable_site_blocks.sql", "0003_masters.sql", "0004_admin_sessions.sql"]
    .map((file) => join(root, "drizzle", file));
}

function applyMigrations(database: DatabaseSync, root: string): void {
  database.exec("CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const hasMigration = database.prepare("SELECT 1 AS found FROM _app_migrations WHERE name = ? LIMIT 1");
  for (const file of migrationFiles(root)) {
    if (!existsSync(file)) throw new Error(`SQLite migration is missing: ${file}`);
    const name = basename(file);
    const applied = hasMigration.get(name);
    if (applied) continue;
    const sql = readFileSync(file, "utf8");
    database.exec("BEGIN");
    try {
      database.exec(sql);
      database.prepare("INSERT INTO _app_migrations (name) VALUES (?)").run(name);
      database.exec("COMMIT");
    } catch (error) {
      try { database.exec("ROLLBACK"); } catch { /* preserve original error */ }
      throw error;
    }
  }
}

function seedIfEmpty(database: DatabaseSync, root: string): void {
  const row = database.prepare("SELECT COUNT(*) AS count FROM salon_settings").get() as { count?: number } | undefined;
  if (Number(row?.count ?? 0) > 0) return;
  const seedPath = join(root, "drizzle", "seeds", "0001_current_site_content.sql");
  if (!existsSync(seedPath)) throw new Error(`SQLite seed is missing: ${seedPath}`);
  database.exec(readFileSync(seedPath, "utf8"));
}

let singleton: SqliteDatabase | undefined;

export function sqlitePath(): string {
  const configured = process.env.SQLITE_PATH || process.env.DATABASE_PATH || ".data/site.sqlite";
  return resolve(process.cwd(), configured);
}

export function getSqliteDatabase(): SqliteDatabase {
  if (singleton) return singleton;
  const root = process.cwd();
  const filePath = sqlitePath();
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  applyMigrations(database, root);
  seedIfEmpty(database, root);
  singleton = new NodeSqliteDatabase(database);
  return singleton;
}

export function closeSqliteDatabase(): void {
  singleton?.close();
  singleton = undefined;
}
