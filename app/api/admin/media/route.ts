import { assertAdminRequest, AdminApiError, errorResponse, jsonResponse } from "../admin-api";
import { runtimeEnv } from "../auth-runtime";
import { getSqliteDatabase } from "../../../../db/sqlite";
import type { SqliteDatabase } from "../../../../db/sqlite";
import { deleteYandexObject, isSafeStorageKey, putYandexObject } from "../yandex-storage";
import { assertSafeRecordId, validateImageFile, validateVideoFile } from "../media-validation";
import { mediaStorageKey } from "../media-key";

type MediaResource = "portfolio_items" | "offers" | "salon_settings";
type MediaField = "portfolio" | "front" | "back" | "atmosphere" | "award_video";

function mediaInput(value: string | null): { resource: MediaResource; field: MediaField } {
  if (value === "portfolio_items") return { resource: value, field: "portfolio" };
  if (value === "offers") return { resource: value, field: "front" };
  if (value === "salon_settings") return { resource: value, field: "atmosphere" };
  throw new AdminApiError("Для загрузки укажите корректный ресурс медиа");
}

function fieldInput(resource: MediaResource, value: string | null): MediaField {
  if (resource === "portfolio_items") return "portfolio";
  if (value === "front" || value === "back") return value;
  if (resource === "salon_settings" && (value === "atmosphere" || value === "award_video")) return value;
  throw new AdminApiError(resource === "offers" ? "Для предложения укажите field=front или field=back" : "Для блока сайта укажите корректное поле медиа");
}

function mediaColumns(resource: MediaResource, field: MediaField): { key: string; url: string } {
  if (resource === "portfolio_items") return { key: "image_storage_key", url: "image_url" };
  if (resource === "salon_settings") return field === "award_video"
    ? { key: "award_video_storage_key", url: "award_video_url" }
    : { key: "atmosphere_image_storage_key", url: "atmosphere_image_url" };
  return field === "front"
    ? { key: "front_storage_key", url: "front_url" }
    : { key: "back_storage_key", url: "back_url" };
}

function recordId(request: Request): string {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new AdminApiError("Некорректный id записи");
  return assertSafeRecordId(id);
}

async function bindings(): Promise<{ database: SqliteDatabase; env: Partial<Env> }> {
  const env = await runtimeEnv();
  const database = getSqliteDatabase();
  if (!database || !env) throw new AdminApiError("SQLite или Yandex Object Storage недоступен в текущем окружении", 503);
  return { database, env };
}

export async function POST(request: Request): Promise<Response> {
  try {
    await assertAdminRequest(request);
    const url = new URL(request.url);
    const { resource } = mediaInput(url.searchParams.get("resource"));
    const field = fieldInput(resource, url.searchParams.get("field"));
    const rawId = url.searchParams.get("id");
    const id = rawId ? assertSafeRecordId(rawId) : null;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AdminApiError("Поле file должно содержать файл");
    const validated = resource === "salon_settings" && field === "award_video"
      ? await validateVideoFile(file)
      : await validateImageFile(file);
    const detectedType = validated.contentType;

    const { database, env } = await bindings();
    if (!id) {
      const key = mediaStorageKey(resource, `draft-${crypto.randomUUID()}`, validated.extension);
      await putYandexObject(env, key, validated.bytes, detectedType);
      return jsonResponse({ storage_key: key, url: `/media/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}` }, 201);
    }
    const table = resource === "portfolio_items" ? "portfolio_items" : resource === "offers" ? "offers" : "salon_settings";
    const columns = mediaColumns(resource, field);
    const existing = await database.prepare(`SELECT id, ${columns.key} AS storage_key FROM ${table} WHERE id = ? LIMIT 1`).bind(resource === "salon_settings" ? Number(id) : id).all<{ id: string; storage_key: string | null }>();
    if (!existing.results[0]) throw new AdminApiError("Запись не найдена", 404);
    const oldKey = existing.results[0].storage_key;
    const key = mediaStorageKey(resource, id, validated.extension);
    await putYandexObject(env, key, validated.bytes, detectedType);
    try {
      await database.prepare(`UPDATE ${table} SET ${columns.key} = ?, ${columns.url} = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(key, resource === "salon_settings" ? Number(id) : id).run();
    } catch (error) {
      await deleteYandexObject(env, key);
      throw error;
    }
    if (oldKey && isSafeStorageKey(oldKey)) await deleteYandexObject(env, oldKey);
    const row = await database.prepare(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`).bind(resource === "salon_settings" ? Number(id) : id).all<Record<string, unknown>>();
    return jsonResponse({ item: row.results[0] ?? null, storage_key: key, field }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    await assertAdminRequest(request);
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");
    if (resource !== "portfolio_items" && resource !== "offers" && resource !== "salon_settings") throw new AdminApiError("Некорректный resource");
    const looseKey = url.searchParams.get("storage_key");
    if (looseKey) {
      if (!isSafeStorageKey(looseKey)) throw new AdminApiError("Некорректный storage key");
      const { env } = await bindings();
      await deleteYandexObject(env, looseKey);
      return jsonResponse({ deleted: true, storage_key: looseKey });
    }
    const field = fieldInput(resource, url.searchParams.get("field"));
    const id = recordId(request);
    const { database, env } = await bindings();
    const table = resource === "portfolio_items" ? "portfolio_items" : resource === "offers" ? "offers" : "salon_settings";
    const columns = mediaColumns(resource, field);
    const existing = await database.prepare(`SELECT ${columns.key} AS storage_key, ${columns.url} AS image_url FROM ${table} WHERE id = ? LIMIT 1`).bind(resource === "salon_settings" ? Number(id) : id).all<{ storage_key: string | null; image_url: string | null }>();
    const row = existing.results[0];
    if (!row) throw new AdminApiError("Запись не найдена", 404);
    // Remove the managed object first. If storage is temporarily unavailable,
    // keep the database reference intact so the administrator can retry safely.
    if (row.storage_key && isSafeStorageKey(row.storage_key)) await deleteYandexObject(env, row.storage_key);
    if (resource === "portfolio_items") {
      // Removing a photo must not also hide the portfolio record: visibility
      // is a separate admin action. The public reader already skips entries
      // without an image, while the local legacy file is never touched.
      await database.prepare(`UPDATE ${table} SET image_storage_key = NULL, image_url = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
    } else {
      await database.prepare(`UPDATE ${table} SET ${columns.key} = NULL, ${columns.url} = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(resource === "salon_settings" ? Number(id) : id).run();
    }
    const updated = await database.prepare(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`).bind(resource === "salon_settings" ? Number(id) : id).all<Record<string, unknown>>();
    return jsonResponse({ deleted: true, id, item: updated.results[0] ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
