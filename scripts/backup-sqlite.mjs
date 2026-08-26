import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const projectRoot = process.cwd();
const configuredPath = process.env.SQLITE_PATH || process.env.DATABASE_PATH || ".data/site.sqlite";
const sourcePath = resolve(projectRoot, configuredPath);
const backupDirectory = resolve(projectRoot, process.env.SQLITE_BACKUP_DIR || ".data/backups");

if (!existsSync(sourcePath)) {
  throw new Error(`SQLite database does not exist: ${sourcePath}`);
}

mkdirSync(backupDirectory, { recursive: true });
const sourceName = basename(sourcePath, extname(sourcePath));
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupPath = join(backupDirectory, `${sourceName}-${timestamp}.sqlite`);

const database = new DatabaseSync(sourcePath);
try {
  database.exec("PRAGMA busy_timeout = 5000;");
  const escapedBackupPath = backupPath.replaceAll("'", "''");
  database.exec(`VACUUM INTO '${escapedBackupPath}'`);
} finally {
  database.close();
}

const verificationDatabase = new DatabaseSync(backupPath);
try {
  const result = verificationDatabase.prepare("PRAGMA integrity_check").get();
  if (result?.integrity_check !== "ok") {
    throw new Error("SQLite backup integrity check failed");
  }
} finally {
  verificationDatabase.close();
}

console.log(`SQLite backup created: ${backupPath}`);
