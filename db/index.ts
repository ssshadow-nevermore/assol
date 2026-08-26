/**
 * The application database is a regular SQLite file.  Keeping this entry
 * point tiny makes the future VPS setup (Node + PM2) identical to local dev.
 * Drizzle's schema remains the canonical model; the request-facing code uses
 * the small SQL adapter exposed by `getSqliteDatabase` for compatibility with
 * the existing route handlers.
 */
export { closeSqliteDatabase, getSqliteDatabase, sqlitePath } from "./sqlite";
