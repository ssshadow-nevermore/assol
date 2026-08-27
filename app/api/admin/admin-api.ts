import { getSqliteDatabase } from "../../../db/sqlite";
import type { SqliteDatabase } from "../../../db/sqlite";
import { isSameOriginRequest, requireAdminSession } from "./access";
import { getAuthRuntime } from "./auth-runtime";
import { YandexStorageError } from "./yandex-storage";
import { MediaValidationError } from "./media-validation";
import { formatStoredPrice } from "../../price-utils";
import { validateWorkingHoursInput, WorkingHoursValidationError } from "./working-hours-validation";

export const ADMIN_RESOURCES = [
  "service_categories",
  "services",
  "salon_settings",
  "working_hours",
  "external_links",
  "portfolio_items",
  "offers",
  "offer_conditions",
  "offer_service_rules",
  "masters",
] as const;

export type AdminResource = (typeof ADMIN_RESOURCES)[number];

type JsonRecord = Record<string, unknown>;
type NormalizedRecord = Record<string, string | number | null>;

const fieldLabels: Record<string, string> = {
  title: "Название", short_title: "Короткое название", name: "Название", legacy_id: "Системный идентификатор", number: "Номер в каталоге", slug: "Адрес предложения",
  description: "Описание", note: "Примечание", alt_text: "Alt-текст",
  category_id: "Категория", service_category_id: "Категория",
  price_amount: "Цена", price_min: "Минимальная цена", price_max: "Максимальная цена",
  price_tiers_json: "Варианты цены", price_from_type: "Тип цены", pricing_type: "Тип цены",
  price_display_text: "Цена на сайте", price_from_display_text: "Цена на сайте", price_note: "Примечание к цене",
  duration_min_minutes: "Длительность услуги", duration_max_minutes: "Максимальная длительность",
  sort_order: "Порядок отображения", email: "Email", phone: "Телефон", display_phone: "Телефон для показа",
  street_address: "Адрес", url: "Ссылка", kind: "Назначение ссылки", link_key: "Идентификатор ссылки",
  offer_id: "Предложение", service_id: "Услуга", condition_type: "Тип условия", operator: "Сравнение",
  amount_value: "Сумма условия", benefit_type: "Тип выгоды", benefit_value: "Размер выгоды", nominal_value: "Номинал",
  linked_service_id: "Связанная услуга", type: "Тип предложения", status: "Статус", rule_type: "Тип скидки", currency: "Валюта",
  flip_enabled: "Переворачивать карточку",
};

function fieldLabel(field: string): string { return fieldLabels[field] ?? field; }

const tableByResource: Record<AdminResource, string> = {
  service_categories: "service_categories",
  services: "services",
  salon_settings: "salon_settings",
  working_hours: "working_hours",
  external_links: "external_links",
  portfolio_items: "portfolio_items",
  offers: "offers",
  offer_conditions: "offer_conditions",
  offer_service_rules: "offer_service_rules",
  masters: "masters",
};

// These links are part of the public page contract.  They are intentionally
// not exposed in the visual contacts editor, and the API must not allow an
// authenticated caller to hide, delete, or rename them into a broken state.
// Otherwise the server-rendered public page would fail while looking up the
// required booking, review, map, and contact URLs.
const REQUIRED_EXTERNAL_LINK_KEYS = new Set([
  "phone",
  "max",
  "email",
  "vk",
  "dikidi_widget",
  "dikidi_script",
  "yandex_maps",
  "yandex_reviews",
  "yandex_reviews_widget",
  "yandex_map_widget_desktop",
  "yandex_map_widget_mobile",
]);

const columnsByResource: Record<AdminResource, readonly string[]> = {
  service_categories: ["id", "legacy_id", "number", "title", "short_title", "description", "price_from_type", "price_from_amount", "price_from_min", "price_from_max", "price_from_display_text", "price_note", "master_ids_json", "is_active", "sort_order"],
  services: ["id", "category_id", "legacy_id", "name", "note", "pricing_type", "price_amount", "price_min", "price_max", "price_tiers_json", "price_display_text", "duration_text", "duration_min_minutes", "duration_max_minutes", "is_active", "sort_order"],
  salon_settings: ["id", "salon_name", "phone", "display_phone", "email", "region", "city", "street_address", "latitude", "longitude", "yandex_organization_id", "logo_storage_key", "logo_url", "award_eyebrow", "award_title", "award_description", "award_video_storage_key", "award_video_url", "atmosphere_image_storage_key", "atmosphere_image_url", "is_active"],
  working_hours: ["id", "weekday", "specific_date", "is_closed", "opens_at", "closes_at", "note", "is_active", "sort_order"],
  external_links: ["id", "link_key", "kind", "label", "url", "phone_to_copy", "open_in_new_tab", "is_active", "sort_order"],
  portfolio_items: ["id", "service_category_id", "title", "description", "alt_text", "image_storage_key", "image_url", "is_active", "sort_order"],
  offers: ["id", "linked_service_id", "type", "slug", "title", "short_title", "eyebrow", "description", "legal_note", "benefit_type", "benefit_value", "nominal_value", "currency", "free_visit_number", "front_storage_key", "front_url", "back_storage_key", "back_url", "flip_enabled", "valid_from", "valid_until", "is_transferable", "can_combine_with_other_offers", "status", "sort_order"],
  offer_conditions: ["id", "offer_id", "condition_type", "operator", "amount_value", "text_value", "service_id", "service_category_id", "title", "description", "is_active", "sort_order"],
  offer_service_rules: ["id", "offer_id", "service_id", "rule_type", "discount_amount", "discount_percent", "free_visit_number", "usage_limit", "shared_usage_group", "is_active", "sort_order"],
  masters: ["id", "name", "specialization", "services_text", "image_storage_key", "image_url", "is_active", "sort_order"],
};

const requiredByResource: Partial<Record<AdminResource, readonly string[]>> = {
  service_categories: ["legacy_id", "number", "title", "short_title", "description", "price_from_type"],
  services: ["category_id", "legacy_id", "name", "pricing_type"],
  salon_settings: ["salon_name", "phone", "display_phone", "street_address"],
  external_links: ["link_key", "kind", "label", "url"],
  portfolio_items: ["title", "alt_text"],
  offers: ["type", "slug", "title", "description", "benefit_type", "currency", "status"],
  offer_conditions: ["offer_id", "condition_type", "operator", "description"],
  offer_service_rules: ["offer_id", "service_id", "rule_type"],
  masters: ["name", "specialization", "services_text"],
};

const enumValues: Record<string, readonly string[]> = {
  price_from_type: ["fixed", "from", "range", "free", "custom"],
  pricing_type: ["fixed", "from", "range", "tiers", "free", "custom"],
  kind: ["vk", "max", "email", "dikidi_widget", "dikidi_script", "yandex_maps", "yandex_reviews", "other"],
  type: ["promotion", "loyalty", "certificate", "gift_card"],
  benefit_type: ["fixed_discount", "percent_discount", "nominal", "free_nth_visit", "free_service", "custom"],
  status: ["draft", "active", "hidden", "expired"],
  condition_type: ["minimum_single_service_price", "minimum_order_total", "service_purchase", "category_purchase", "new_customer", "nth_visit", "custom"],
  operator: ["gt", "gte", "eq", "lte", "lt", "custom"],
  rule_type: ["fixed_discount", "percent_discount", "free", "free_nth_visit"],
};

const integerColumns = new Set([
  "id", "price_from_amount", "price_from_min", "price_from_max", "price_amount", "price_min", "price_max", "duration_min_minutes", "duration_max_minutes", "weekday", "is_closed", "is_active", "sort_order", "open_in_new_tab", "benefit_value", "nominal_value", "free_visit_number", "is_transferable", "can_combine_with_other_offers", "flip_enabled", "amount_value", "discount_amount", "discount_percent", "usage_limit",
]);
const nullableColumns = new Set([
  "note", "price_from_amount", "price_from_min", "price_from_max", "price_amount", "price_min", "price_max", "price_from_display_text", "price_note", "price_tiers_json", "price_display_text", "duration_text", "duration_min_minutes", "duration_max_minutes", "email", "region", "city", "latitude", "longitude", "yandex_organization_id", "logo_storage_key", "logo_url", "award_eyebrow", "award_title", "award_description", "award_video_storage_key", "award_video_url", "atmosphere_image_storage_key", "atmosphere_image_url", "weekday", "specific_date", "opens_at", "closes_at", "phone_to_copy", "service_category_id", "description", "image_storage_key", "image_url", "linked_service_id", "short_title", "eyebrow", "legal_note", "benefit_value", "nominal_value", "free_visit_number", "amount_value", "front_storage_key", "front_url", "back_storage_key", "back_url", "valid_from", "valid_until", "text_value", "service_id", "title", "discount_amount", "discount_percent", "usage_limit", "shared_usage_group",
]);

export class AdminApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export async function assertAdminRequest(request: Request): Promise<void> {
  const result = await requireAdminSession(request, await getAuthRuntime());
  if (!result.ok) {
    const payload = await result.response.json() as { error?: string };
    throw new AdminApiError(payload.error ?? "Требуется авторизация", result.response.status);
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !isSameOriginRequest(request)) {
    throw new AdminApiError("Недопустимый источник запроса", 403);
  }
}

export function jsonResponse(payload: JsonRecord, status = 200): Response {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(error: unknown): Response {
  const status = error instanceof AdminApiError || error instanceof YandexStorageError || error instanceof MediaValidationError ? error.status : 500;
  const message = error instanceof AdminApiError || error instanceof YandexStorageError || error instanceof MediaValidationError ? error.message : "Внутренняя ошибка административного API";
  if (status >= 500) {
    console.error(JSON.stringify({ message, error: error instanceof Error ? error.message : String(error) }));
  }
  return jsonResponse({ error: message }, status);
}

export function getResource(value: string | null): AdminResource {
  if (!value || !ADMIN_RESOURCES.includes(value as AdminResource)) {
    throw new AdminApiError("Неизвестный ресурс административного API");
  }
  return value as AdminResource;
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdminApiError("Тело запроса должно быть JSON-объектом");
  return value as JsonRecord;
}

export async function readJsonRecord(request: Request): Promise<JsonRecord> {
  try {
    return asRecord(await request.json());
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError("Некорректный JSON в теле запроса");
  }
}

function stringValue(value: unknown, field: string, required: boolean): string | null {
  if (value === null || value === undefined || value === "") {
    if (required) throw new AdminApiError(`Поле «${fieldLabel(field)}» обязательно`);
    return null;
  }
  if (typeof value !== "string") throw new AdminApiError(`Поле «${fieldLabel(field)}» должно быть строкой`);
  const result = value.trim();
  if (!result && required) throw new AdminApiError(`Поле «${fieldLabel(field)}» обязательно`);
  return result || null;
}

function integerValue(value: unknown, field: string, nullable = false): number | null {
  if (value === null || value === undefined || value === "") {
    if (nullable) return null;
    throw new AdminApiError(`Поле «${fieldLabel(field)}» должно быть целым числом`);
  }
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(result)) throw new AdminApiError(`Поле «${fieldLabel(field)}» должно быть целым числом`);
  return result;
}

function realValue(value: unknown, field: string, nullable = false): number | null {
  if (value === null || value === undefined || value === "") {
    if (nullable) return null;
    throw new AdminApiError(`Поле «${fieldLabel(field)}» должно быть числом`);
  }
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(result)) throw new AdminApiError(`Поле «${fieldLabel(field)}» должно быть числом`);
  return result;
}

function booleanValue(value: unknown, field: string): number {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0" || value === undefined) return 0;
  throw new AdminApiError(`Поле «${fieldLabel(field)}» должно быть отмечено или снято`);
}

function enumValue(value: unknown, field: string): string {
  const result = stringValue(value, field, true) ?? "";
  const values = enumValues[field];
  if (values && !values.includes(result)) throw new AdminApiError(`Недопустимое значение поля «${fieldLabel(field)}»`);
  return result;
}

function jsonValue(value: unknown, field: string, nullable = false): string | null {
  if (value === null || value === undefined || value === "") {
    if (nullable) return null;
    return "[]";
  }
  if (typeof value === "string") {
    try {
      JSON.parse(value);
    } catch {
      throw new AdminApiError(`Поле «${fieldLabel(field)}» заполнено некорректно`);
    }
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    throw new AdminApiError(`Поле «${fieldLabel(field)}» заполнено некорректно`);
  }
}

function validatePricing(record: NormalizedRecord): void {
  const type = record.pricing_type;
  if (type === "fixed" || type === "from") {
    const amount = record.price_amount;
    if (typeof amount !== "number" || amount < 0) throw new AdminApiError("Для этого типа цены укажите цену не меньше нуля");
  } else if (type === "range") {
    if (typeof record.price_min !== "number" || typeof record.price_max !== "number" || record.price_min < 0 || record.price_max < record.price_min) throw new AdminApiError("Укажите корректный диапазон цен");
  } else if (type === "tiers") {
    const tiers = JSON.parse(String(record.price_tiers_json ?? "[]")) as unknown;
    if (!Array.isArray(tiers) || tiers.length === 0) throw new AdminApiError("Добавьте хотя бы один вариант цены");
  } else if (type === "free" && record.price_amount !== null && record.price_amount !== 0) {
    throw new AdminApiError("Для бесплатной услуги цена должна быть 0 или не задана");
  }
}

function validateDuration(record: NormalizedRecord): void {
  const min = record.duration_min_minutes;
  const max = record.duration_max_minutes;
  if (min === null && max === null) return;
  if (typeof min !== "number" || min < 1 || min > 1440) {
    throw new AdminApiError("Поле «Длительность услуги» должно быть от 1 до 1440 минут");
  }
  if (max !== null && (typeof max !== "number" || max < min || max > 1440)) {
    throw new AdminApiError("Поле «Максимальная длительность» должно быть не меньше минимальной и не больше 1440 минут");
  }
}

function validateOffer(record: NormalizedRecord): void {
  if (record.benefit_type === "nominal") {
    if (typeof record.nominal_value !== "number" || record.nominal_value < 0 || record.benefit_value !== null) throw new AdminApiError("Для типа выгоды «Номинал» укажите номинал и не заполняйте размер выгоды");
  }
  if (record.benefit_type === "free_nth_visit" && (typeof record.free_visit_number !== "number" || record.free_visit_number < 2)) throw new AdminApiError("Укажите номер бесплатного посещения не меньше 2");
  if (record.valid_from && record.valid_until && String(record.valid_until) < String(record.valid_from)) throw new AdminApiError("Дата окончания не может быть раньше даты начала");
  if (record.type === "certificate" && !record.linked_service_id) throw new AdminApiError("Сертификат должен быть связан с продаваемой услугой");
}

function validateSalonSettings(record: NormalizedRecord): void {
  if (record.email && !/^\S+@\S+\.\S+$/.test(String(record.email))) throw new AdminApiError("Укажите корректный email");
  if (typeof record.phone !== "string" || !/[0-9]{5,}/.test(record.phone.replace(/\D/g, ""))) throw new AdminApiError("Укажите корректный телефон");
  if (typeof record.display_phone !== "string" || !/[0-9]{5,}/.test(record.display_phone.replace(/\D/g, ""))) throw new AdminApiError("Укажите корректный телефон для показа");
}

function validateExternalLink(record: NormalizedRecord): void {
  try {
    const url = new URL(String(record.url));
    if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new AdminApiError("Укажите корректную ссылку");
  }
}

function normalize(resource: AdminResource, input: JsonRecord, existing?: JsonRecord): NormalizedRecord {
  const source: JsonRecord = { ...(existing ?? {}), ...input };
  const required = requiredByResource[resource] ?? [];
  const result: NormalizedRecord = {};
  for (const column of columnsByResource[resource]) {
    const value = source[column];
    const isRequired = required.includes(column);
    if (column === "id" && resource === "salon_settings") {
      result[column] = integerValue(value ?? 1, column);
    } else if (column === "id") {
      result[column] = stringValue(value ?? crypto.randomUUID(), column, true) ?? crypto.randomUUID();
    } else if (column === "is_active" || column === "open_in_new_tab" || column === "is_transferable" || column === "can_combine_with_other_offers" || column === "flip_enabled" || column === "is_closed") {
      result[column] = booleanValue(value === undefined && column !== "is_closed" ? 1 : value, column);
    } else if (column === "price_from_type" || column === "pricing_type" || column === "kind" || column === "type" || column === "benefit_type" || column === "status" || column === "condition_type" || column === "operator" || column === "rule_type") {
      result[column] = enumValue(value, column);
    } else if (column === "master_ids_json" || column === "price_tiers_json") {
      result[column] = jsonValue(value, column) ?? "[]";
    } else if (column === "latitude" || column === "longitude") {
      result[column] = realValue(value, column, true);
    } else if (integerColumns.has(column)) {
      result[column] = integerValue(value, column, nullableColumns.has(column));
    } else {
      result[column] = stringValue(value, column, isRequired);
    }
  }
  if (resource === "services") {
    validatePricing(result);
    validateDuration(result);
    result.price_display_text = formatStoredPrice(result);
    const durationMin = result.duration_min_minutes;
    const durationMax = result.duration_max_minutes;
    if (durationMin === null) result.duration_text = null;
    else if (typeof durationMin === "number" && typeof durationMax === "number" && durationMax > durationMin) result.duration_text = `${durationMin}–${durationMax} минут`;
    else result.duration_text = `${durationMin} минут`;
  }
  if (resource === "salon_settings") validateSalonSettings(result);
  if (resource === "external_links") validateExternalLink(result);
  if (resource === "offers") validateOffer(result);
  // New portfolio records need an image, while an existing record may be
  // intentionally cleared by the admin media action.  Keep that edit valid
  // so deleting an image does not leave the user trapped in the modal.
  if (resource === "portfolio_items" && !existing && !result.image_url && !result.image_storage_key) throw new AdminApiError("Укажите image_url или image_storage_key");
  // The first migration keeps the image-reference check compatible with the
  // legacy empty-string value. `stringValue` normalizes an empty input to
  // null, which would violate that check on an existing record after the
  // image is removed. Preserve the empty marker while still rendering it as
  // no image in the public/admin URL helpers.
  if (resource === "portfolio_items" && existing && !result.image_url && !result.image_storage_key) result.image_url = "";
  if (resource === "working_hours") {
    const recurring = result.weekday !== null && result.specific_date === null;
    const specific = result.weekday === null && result.specific_date !== null;
    if (!recurring && !specific) throw new AdminApiError("График должен содержать weekday или specific_date");
    if (result.is_closed === 0 && (!result.opens_at || !result.closes_at)) throw new AdminApiError("Для рабочего дня укажите opens_at и closes_at");
    try {
      validateWorkingHoursInput(result);
    } catch (error) {
      if (error instanceof WorkingHoursValidationError) throw new AdminApiError(error.message);
      throw error;
    }
  }
  if (resource === "offer_conditions") {
    if (["minimum_single_service_price", "minimum_order_total"].includes(String(result.condition_type)) && (typeof result.amount_value !== "number" || result.amount_value < 0)) throw new AdminApiError("Для денежного условия укажите сумму не меньше нуля");
    if (result.condition_type === "service_purchase" && !result.service_id) throw new AdminApiError("Для этого условия выберите услугу");
    if (result.condition_type === "category_purchase" && !result.service_category_id) throw new AdminApiError("Для этого условия выберите направление");
  }
  if (resource === "offer_service_rules") {
    if (result.rule_type === "fixed_discount" && (typeof result.discount_amount !== "number" || result.discount_amount <= 0)) throw new AdminApiError("Укажите скидку в рублях больше нуля");
    if (result.rule_type === "percent_discount" && (typeof result.discount_percent !== "number" || result.discount_percent < 1 || result.discount_percent > 100)) throw new AdminApiError("Процент скидки должен быть от 1 до 100");
    if (result.rule_type === "free_nth_visit" && (typeof result.free_visit_number !== "number" || result.free_visit_number < 2)) throw new AdminApiError("Укажите номер бесплатного посещения не меньше 2");
  }
  return result;
}

async function databaseOrThrow(): Promise<SqliteDatabase> {
  try {
    return getSqliteDatabase();
  } catch {
    throw new AdminApiError("SQLite база недоступна в текущем окружении", 503);
  }
}

async function rowById(database: SqliteDatabase, resource: AdminResource, id: string | number): Promise<JsonRecord | null> {
  const table = tableByResource[resource];
  const result = await database.prepare(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`).bind(id).all<JsonRecord>();
  return result.results[0] ?? null;
}

async function requireForeignKeys(database: SqliteDatabase, resource: AdminResource, record: NormalizedRecord): Promise<void> {
  const checks: Array<[string, string | number, string]> = [];
  if (resource === "services" && record.category_id) checks.push(["service_categories", record.category_id, "category_id"]);
  if (resource === "portfolio_items" && record.service_category_id) checks.push(["service_categories", record.service_category_id, "service_category_id"]);
  if (resource === "offers" && record.linked_service_id) checks.push(["services", record.linked_service_id, "linked_service_id"]);
  if (resource === "offer_conditions") {
    if (typeof record.offer_id === "string") {
      checks.push(["offers", record.offer_id, "offer_id"]);
      if (record.condition_type === "minimum_single_service_price") {
        const offer = await database.prepare("SELECT type FROM offers WHERE id = ? LIMIT 1").bind(record.offer_id).all<{ type: string }>();
        if (offer.results[0]?.type === "certificate" && (record.operator !== "gt" || record.amount_value !== 3000)) {
          throw new AdminApiError("Для сертификата условие выдачи должно быть minimum_single_service_price gt 3000");
        }
      }
    }
    if (record.service_id) checks.push(["services", record.service_id, "service_id"]);
    if (record.service_category_id) checks.push(["service_categories", record.service_category_id, "service_category_id"]);
  }
  if (resource === "offer_service_rules") {
    if (typeof record.offer_id === "string") checks.push(["offers", record.offer_id, "offer_id"]);
    if (typeof record.service_id === "string") checks.push(["services", record.service_id, "service_id"]);
  }
  for (const [table, id, field] of checks) {
    const result = await database.prepare(`SELECT 1 AS found FROM ${table} WHERE id = ? LIMIT 1`).bind(id).all<{ found: number }>();
    if (result.results.length === 0) throw new AdminApiError(`Связанная запись «${fieldLabel(field)}» не найдена`);
  }
}

function assertRequiredExternalLinkMutation(resource: AdminResource, existing: JsonRecord | null, input: JsonRecord, operation: "update" | "hide" | "delete"): void {
  if (resource !== "external_links" || !existing) return;
  const currentKey = String(existing.link_key ?? "");
  if (!REQUIRED_EXTERNAL_LINK_KEYS.has(currentKey)) return;
  if (operation === "hide" || operation === "delete") {
    throw new AdminApiError("Системную ссылку нельзя скрыть или удалить");
  }
  if (input.link_key !== undefined && String(input.link_key).trim() !== currentKey) {
    throw new AdminApiError("Системную ссылку нельзя переименовать");
  }
  if (input.is_active !== undefined && Number(input.is_active) === 0) {
    throw new AdminApiError("Системную ссылку нельзя скрыть");
  }
}

export async function listResource(resource: AdminResource): Promise<JsonRecord[]> {
  const database = await databaseOrThrow();
  const table = tableByResource[resource];
  const order = resource === "salon_settings" ? "id" : "sort_order, id";
  const result = await database.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all<JsonRecord>();
  return result.results;
}

export async function createResource(resource: AdminResource, input: JsonRecord): Promise<JsonRecord> {
  const database = await databaseOrThrow();
  const record = normalize(resource, input);
  await requireForeignKeys(database, resource, record);
  const columns = columnsByResource[resource];
  const values = columns.map((column) => record[column] ?? null);
  if (resource === "salon_settings") {
    const assignments = columns.filter((column) => column !== "id").map((column) => `${column} = excluded.${column}`).join(", ");
    await database.prepare(`INSERT INTO salon_settings (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")}) ON CONFLICT(id) DO UPDATE SET ${assignments}, updated_at = CURRENT_TIMESTAMP`).bind(...values).run();
  } else {
    await database.prepare(`INSERT INTO ${tableByResource[resource]} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).bind(...values).run();
  }
  const recordId = record.id;
  if (typeof recordId !== "string" && typeof recordId !== "number") throw new AdminApiError("Некорректный id записи", 500);
  const row = await rowById(database, resource, recordId);
  if (!row) throw new AdminApiError("Запись создана, но не прочитана обратно", 500);
  return row;
}

export async function updateResource(resource: AdminResource, id: string, input: JsonRecord): Promise<JsonRecord> {
  const database = await databaseOrThrow();
  const existing = await rowById(database, resource, resource === "salon_settings" ? Number(id) : id);
  if (!existing) throw new AdminApiError("Запись не найдена", 404);
  if (typeof existing.id !== "string" && typeof existing.id !== "number") throw new AdminApiError("Некорректный id записи", 500);
  assertRequiredExternalLinkMutation(resource, existing, input, "update");
  const existingId = existing.id;
  const record = normalize(resource, { ...input, id: existingId }, existing);
  await requireForeignKeys(database, resource, record);
  const columns = columnsByResource[resource].filter((column) => column !== "id");
  await database.prepare(`UPDATE ${tableByResource[resource]} SET ${columns.map((column) => `${column} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(...columns.map((column) => record[column] ?? null), existingId).run();
  const row = await rowById(database, resource, existingId);
  if (!row) throw new AdminApiError("Запись обновлена, но не прочитана обратно", 500);
  return row;
}

export async function hideResource(resource: AdminResource, id: string): Promise<JsonRecord> {
  const database = await databaseOrThrow();
  if (resource === "salon_settings") throw new AdminApiError("Контакты нельзя скрыть: отредактируйте запись вместо удаления");
  const existing = await rowById(database, resource, id);
  if (!existing) throw new AdminApiError("Запись не найдена", 404);
  assertRequiredExternalLinkMutation(resource, existing, {}, "hide");
  const table = tableByResource[resource];
  if (resource === "offers") {
    await database.prepare(`UPDATE ${table} SET status = 'hidden', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
  } else {
    await database.prepare(`UPDATE ${table} SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
  }
  const row = await rowById(database, resource, id);
  if (!row) throw new AdminApiError("Запись скрыта, но не прочитана обратно", 500);
  return row;
}

export async function deleteResource(resource: AdminResource, id: string): Promise<void> {
  const database = await databaseOrThrow();
  if (resource === "salon_settings") throw new AdminApiError("Контакты нельзя удалить");
  const existing = await rowById(database, resource, id);
  if (!existing) throw new AdminApiError("Запись не найдена", 404);
  assertRequiredExternalLinkMutation(resource, existing, {}, "delete");
  try {
    await database.prepare(`DELETE FROM ${tableByResource[resource]} WHERE id = ?`).bind(id).run();
  } catch (error) {
    const detail = error instanceof Error ? error.message.toLowerCase() : "";
    if (detail.includes("foreign key") || detail.includes("constraint")) {
      throw new AdminApiError("Запись нельзя удалить: сначала уберите связанные услуги или предложения");
    }
    throw error;
  }
}
