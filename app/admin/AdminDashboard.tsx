"use client";

/* The first field in each compact modal is intentionally focused for keyboard users. */
/* eslint-disable jsx-a11y/no-autofocus */
/* Media previews may be legacy local paths or Object Storage URLs. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatStoredPrice } from "../price-utils";
import { createClientId } from "./uuid";
import { prepareImageFile } from "./media-client";

type Resource = "service_categories" | "services" | "salon_settings" | "working_hours" | "portfolio_items" | "offers" | "external_links" | "offer_conditions" | "offer_service_rules" | "masters";
type EditableResource = Exclude<Resource, "offer_service_rules" | "offer_conditions">;
type Row = Record<string, unknown>;
type Tier = { id: string; label: string; amount: number };
type ModalResource = EditableResource | null;
type MediaPreviewKey = "portfolio" | "front" | "back" | "atmosphere";
type MediaPreviewUrls = Partial<Record<MediaPreviewKey, string>>;

const emptyRecord: Record<EditableResource, Row> = {
  service_categories: { legacy_id: "", number: "", title: "", short_title: "", description: "", price_from_type: "from", is_active: 1 },
  services: { category_id: "", legacy_id: "", name: "", note: "", pricing_type: "fixed", price_amount: 0, price_min: null, price_max: null, price_display_text: "", price_tiers_json: "[]", duration_text: "", duration_min_minutes: null, duration_max_minutes: null, is_active: 1 },
  salon_settings: { id: 1, salon_name: "", phone: "", display_phone: "", email: "", region: "", city: "", street_address: "", award_eyebrow: "", award_title: "", award_description: "", award_video_storage_key: null, award_video_url: "", atmosphere_image_storage_key: null, atmosphere_image_url: "", is_active: 1 },
  working_hours: { weekday: 1, specific_date: null, is_closed: 0, opens_at: "09:00", closes_at: "20:00", note: "", is_active: 1, sort_order: 0 },
  portfolio_items: { service_category_id: null, title: "", description: "", alt_text: "", image_url: "", image_storage_key: null, is_active: 1 },
  offers: { type: "promotion", slug: "", title: "", short_title: "", eyebrow: "", description: "", benefit_type: "custom", benefit_value: null, nominal_value: null, currency: "RUB", front_url: "", front_storage_key: null, back_url: "", back_storage_key: null, flip_enabled: 0, status: "active", is_active: 1 },
  external_links: { link_key: "", kind: "other", label: "", url: "", phone_to_copy: "", open_in_new_tab: 1, is_active: 1 },
  masters: { name: "", specialization: "", services_text: "", is_active: 1, sort_order: 0 },
};

function text(row: Row | null | undefined, key: string, fallback = ""): string {
  return typeof row?.[key] === "string" ? String(row[key]) : fallback;
}

function number(row: Row | null | undefined, key: string, fallback = 0): number {
  const value = row?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? fallback);
}

function active(row: Row): boolean {
  return row.is_active !== 0 && text(row, "status", "active") !== "hidden";
}

function parseTiers(value: unknown): Tier[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((tier, index) => ({ id: text(tier as Row, "id") || createClientId(`tier-${index}`), label: text(tier as Row, "label"), amount: number(tier as Row, "amount") })).filter((tier) => tier.label);
  } catch {
    return [];
  }
}

function priceLabel(row: Row): string {
  return formatStoredPrice(row);
}

function imageUrl(row: Row | null | undefined, field: "portfolio" | "front" | "back" = "portfolio"): string {
  const keyName = field === "portfolio" ? "image_storage_key" : "front_storage_key";
  const resolvedKeyName = field === "back" ? "back_storage_key" : keyName;
  const urlName = field === "portfolio" ? "image_url" : field === "back" ? "back_url" : "front_url";
  const key = text(row, resolvedKeyName);
  if (key) return `/media/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
  const storedUrl = text(row, urlName);
  if (storedUrl) return storedUrl;
  // Legacy seeded offers kept their artwork in the public image bundle before
  // front/back storage keys were introduced. Keep those images visible in the
  // editor without rewriting the real media record.
  // Legacy artwork belongs only to persisted rows.  A new certificate draft
  // also has `type="certificate"`, but must start without an implicit image;
  // otherwise the editor treats the fallback as an existing upload and the
  // first file selection is routed through the wrong replace path.
  const persisted = row && row.id !== undefined && row.id !== null && String(row.id) !== "";
  if (persisted && field !== "portfolio") {
    const type = text(row, "type");
    if (type === "certificate") return field === "front" ? "/images/certificate-front.webp" : "/images/certificate-back.webp";
    if (type === "loyalty") return field === "front" ? "/images/loyalty-card-front.webp" : "/images/loyalty-card-back.webp";
  }
  return "";
}

function siteBlockMediaUrl(row: Row | null | undefined, field: "atmosphere" | "award_video"): string {
  const keyName = field === "atmosphere" ? "atmosphere_image_storage_key" : "award_video_storage_key";
  const urlName = field === "atmosphere" ? "atmosphere_image_url" : "award_video_url";
  const key = text(row, keyName);
  if (key) return `/media/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
  const storedUrl = text(row, urlName);
  if (storedUrl) return storedUrl;
  return field === "atmosphere" ? "/images/salon-interior-clean.webp" : "/media/good-place-2026.mp4";
}

const DEFAULT_AWARD_EYEBROW = "Яндекс · 2026";
const DEFAULT_AWARD_TITLE = "«Хорошее место» — благодаря вам";
const DEFAULT_AWARD_DESCRIPTION = "Эту награду получают места, которые особенно ценят посетители. Спасибо, что выбираете «Ассоль» и делитесь впечатлениями.";

const ADMIN_REQUEST_TIMEOUT_MS = 15_000;
// Uploads go through the local dev proxy and then Yandex Object Storage. A
// mobile connection can legitimately need longer than a normal database request,
// so keep a bounded but separate media timeout instead of leaving the save
// button waiting forever or aborting a valid upload at 15 seconds.
const ADMIN_MEDIA_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = ADMIN_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const externalSignal = init?.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
  }
  const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (externalSignal?.aborted && !timedOut) throw error;
      throw new Error("Сервер не ответил вовремя. Проверьте соединение и попробуйте ещё раз.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

// Fetch resolves as soon as response headers arrive.  On a flaky mobile/LAN
// connection the body can still stop halfway through, leaving response.json()
// pending forever and keeping the modal in «Сохраняем…».  Keep the body read
// under the same bounded-operation contract as the request itself.
async function readJsonWithTimeout<T>(response: Response, timeoutMs = ADMIN_REQUEST_TIMEOUT_MS, signal?: AbortSignal): Promise<T> {
  let timer: number | undefined;
  let abortHandler: (() => void) | undefined;
  try {
    const aborted = signal?.aborted
      ? Promise.reject<T>(new DOMException("The operation was aborted", "AbortError"))
      : new Promise<T>((_, reject) => {
        if (!signal) return;
        abortHandler = () => reject(new DOMException("The operation was aborted", "AbortError"));
        signal.addEventListener("abort", abortHandler, { once: true });
      });
    return await Promise.race([
      response.json() as Promise<T>,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("Сервер не завершил ответ вовремя. Проверьте соединение и попробуйте ещё раз.")), timeoutMs);
      }),
      aborted,
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
    if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
  }
}

async function api(resource: Resource, method: "POST" | "PATCH", id: string | null, body: Row, signal?: AbortSignal): Promise<Row> {
  const url = `/api/admin?resource=${encodeURIComponent(resource)}${id ? `&id=${encodeURIComponent(id)}` : ""}`;
  const response = await fetchWithTimeout(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const payload = await readJsonWithTimeout<{ item?: Row; error?: string }>(response, ADMIN_REQUEST_TIMEOUT_MS, signal);
  if (!response.ok) throw new Error(payload.error ?? "Не удалось сохранить изменения");
  return payload.item ?? {};
}

async function fetchResource(resource: Resource, signal?: AbortSignal): Promise<Row[]> {
  const response = await fetchWithTimeout(`/api/admin?resource=${encodeURIComponent(resource)}`, { cache: "no-store", signal });
  const payload = await readJsonWithTimeout<{ items?: Row[]; error?: string }>(response, ADMIN_REQUEST_TIMEOUT_MS, signal);
  if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить данные");
  return payload.items ?? [];
}

export default function AdminDashboard() {
  const [categories, setCategories] = useState<Row[]>([]);
  const [services, setServices] = useState<Row[]>([]);
  const [offers, setOffers] = useState<Row[]>([]);
  const [portfolio, setPortfolio] = useState<Row[]>([]);
  const [contacts, setContacts] = useState<Row | null>(null);
  const [workingHours, setWorkingHours] = useState<Row[]>([]);
  const [links, setLinks] = useState<Row[]>([]);
  const [offerConditions, setOfferConditions] = useState<Row[]>([]);
  const [serviceRules, setServiceRules] = useState<Row[]>([]);
  const [masters, setMasters] = useState<Row[]>([]);
  const [offerServiceIds, setOfferServiceIds] = useState<string[]>([]);
  const [offerServiceDiscounts, setOfferServiceDiscounts] = useState<Record<string, string>>({});
  const [certificateDiscountMode, setCertificateDiscountMode] = useState<"common" | "individual">("individual");
  const [commonCertificateDiscount, setCommonCertificateDiscount] = useState("500");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [conditionDrafts, setConditionDrafts] = useState<Row[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [modal, setModal] = useState<ModalResource>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row>({});
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<MediaPreviewUrls>({});
  const [mediaField, setMediaField] = useState<"front" | "back">("front");
  const [siteBlocksMode, setSiteBlocksMode] = useState(false);
  const [mapEditorMode, setMapEditorMode] = useState(false);
  const [siteMediaField, setSiteMediaField] = useState<"atmosphere" | "award_video">("atmosphere");
  const [pendingMediaFiles, setPendingMediaFiles] = useState<Partial<Record<"front" | "back", File>>>({});
  const [mediaBusy, setMediaBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{ resource: EditableResource; id: string } | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  // Keep condition edits available to the save handler even when a delete or
  // keystroke is followed immediately by Save in the same event turn.
  const mediaPreviewUrlsRef = useRef<MediaPreviewUrls>({});
  const conditionDraftsRef = useRef<Row[]>([]);
  const operationLockRef = useRef(false);
  const operationAbortRef = useRef<AbortController | null>(null);
  const mediaSelectionRef = useRef(0);

  const replaceMediaPreview = useCallback((key: MediaPreviewKey, file: File | null) => {
    const previousUrl = mediaPreviewUrlsRef.current[key];
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    if (!file) {
      const next = { ...mediaPreviewUrlsRef.current };
      delete next[key];
      mediaPreviewUrlsRef.current = next;
      setMediaPreviewUrls(next);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    const next = { ...mediaPreviewUrlsRef.current, [key]: nextUrl };
    mediaPreviewUrlsRef.current = next;
    setMediaPreviewUrls(next);
  }, []);

  const clearMediaPreviews = useCallback(() => {
    Object.values(mediaPreviewUrlsRef.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    mediaPreviewUrlsRef.current = {};
    setMediaPreviewUrls({});
  }, []);

  useEffect(() => {
    return () => {
      mediaSelectionRef.current += 1;
      Object.values(mediaPreviewUrlsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      mediaPreviewUrlsRef.current = {};
    };
  }, []);

  const refresh = useCallback(async (preserveScroll = false, signal?: AbortSignal) => {
    const savedScrollY = preserveScroll && typeof window !== "undefined" ? window.scrollY : 0;
    if (!preserveScroll) setLoading(true);
    try {
      const [categoryRows, serviceRows, offerRows, portfolioRows, contactRows, hoursRows, linkRows, conditionRows, ruleRows, masterRows] = await Promise.all([
        fetchResource("service_categories", signal), fetchResource("services", signal), fetchResource("offers", signal), fetchResource("portfolio_items", signal), fetchResource("salon_settings", signal), fetchResource("working_hours", signal), fetchResource("external_links", signal), fetchResource("offer_conditions", signal), fetchResource("offer_service_rules", signal), fetchResource("masters", signal),
      ]);
      setCategories(categoryRows); setServices(serviceRows); setOffers(offerRows); setPortfolio(portfolioRows); setContacts(contactRows[0] ?? null); setWorkingHours(hoursRows); setLinks(linkRows); setOfferConditions(conditionRows); setServiceRules(ruleRows); setMasters(masterRows);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось загрузить данные" });
      if (signal?.aborted) throw error;
    } finally {
      if (!preserveScroll) setLoading(false);
      if (preserveScroll && typeof window !== "undefined") {
        window.requestAnimationFrame(() => window.scrollTo({ top: savedScrollY, behavior: "auto" }));
      }
    }
  }, []);

  // The initial data load synchronizes the client view with SQLite after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const closeEditor = useCallback((force = false) => {
    if (!force && (operationLockRef.current || busy || mediaBusy)) return;
    mediaSelectionRef.current += 1;
    clearMediaPreviews();
    conditionDraftsRef.current = [];
    setModal(null); setModalId(null); setDraft({}); setTiers([]); setMediaFile(null); setPendingMediaFiles({}); setConditionDrafts([]); setMediaField("front"); setSiteMediaField("atmosphere"); setSiteBlocksMode(false); setMapEditorMode(false); setContactPhone(""); setContactEmail(""); setMediaBusy(false);
  }, [busy, mediaBusy, clearMediaPreviews]);

  const cancelAndCloseEditor = useCallback(() => {
    if (operationLockRef.current) operationAbortRef.current?.abort();
    closeEditor(true);
  }, [closeEditor]);

  useEffect(() => {
    if (!modal) return;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelAndCloseEditor();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      const first = modalRef.current?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousActive?.focus();
    };
  }, [modal, cancelAndCloseEditor]);

  const visibleCategories = useMemo(() => categories.filter((item) => showHidden || active(item)), [categories, showHidden]);
  const visibleServices = useMemo(() => services.filter((item) => showHidden || active(item)), [services, showHidden]);
  const visibleOffers = useMemo(() => offers.filter((item) => showHidden || active(item)), [offers, showHidden]);
  const visiblePortfolio = useMemo(() => portfolio.filter((item) => showHidden || active(item)), [portfolio, showHidden]);
  const visibleMasters = useMemo(() => masters.filter((item) => showHidden || active(item)), [masters, showHidden]);
  const fixedWorkingHours = useMemo(() => [...workingHours].sort((left, right) => number(left, "weekday") - number(right, "weekday")), [workingHours]);

  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      const response = await fetch("/api/admin/logout", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("Не удалось завершить сессию");
      window.location.assign("/admin/login");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось завершить сессию" });
      setLogoutBusy(false);
    }
  }

  async function openContactEditor() {
    try {
      mediaSelectionRef.current += 1;
      clearMediaPreviews();
      const row = (await fetchResource("salon_settings"))[0] ?? { ...emptyRecord.salon_settings };
      const next = { ...row,
        phone: text(row, "phone") || text(row, "display_phone"),
        email: text(row, "email") || text(row, "contact_email"),
      };
      setModal("salon_settings");
      setSiteBlocksMode(false);
      setMapEditorMode(false);
      setModalId(row.id === undefined ? null : String(row.id));
      setDraft(next);
      setContactPhone(String(next.phone ?? ""));
      setContactEmail(String(next.email ?? ""));
      conditionDraftsRef.current = [];
      setTiers([]); setMediaFile(null); setPendingMediaFiles({}); setMediaField("front"); setConditionDrafts([]); setMessage(null);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось загрузить контакты" });
    }
  }

  async function openSiteBlocksEditor() {
    try {
      mediaSelectionRef.current += 1;
      clearMediaPreviews();
      const row = (await fetchResource("salon_settings"))[0] ?? { ...emptyRecord.salon_settings };
      setModal("salon_settings");
      setSiteBlocksMode(true);
      setMapEditorMode(false);
      setModalId(row.id === undefined ? "1" : String(row.id));
      setDraft({
        ...row,
        award_eyebrow: text(row, "award_eyebrow") || DEFAULT_AWARD_EYEBROW,
        award_title: text(row, "award_title") || DEFAULT_AWARD_TITLE,
        award_description: text(row, "award_description") || DEFAULT_AWARD_DESCRIPTION,
      });
      conditionDraftsRef.current = [];
      setTiers([]); setMediaFile(null); setPendingMediaFiles({}); setSiteMediaField("atmosphere"); setMessage(null);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось загрузить блоки сайта" });
    }
  }

  function openMapEditor() {
    mediaSelectionRef.current += 1;
    clearMediaPreviews();
    const mapLink = links.find((link) => text(link, "link_key") === "yandex_maps");
    setModal("external_links");
    setMapEditorMode(true);
    setSiteBlocksMode(false);
    setModalId(mapLink?.id === undefined ? null : String(mapLink.id));
    setDraft({ source_url: text(mapLink, "url") });
    conditionDraftsRef.current = [];
    setTiers([]); setMediaFile(null); setPendingMediaFiles({}); setConditionDrafts([]); setMessage(null);
  }

  function openEditor(resource: EditableResource, row?: Row, categoryId?: string) {
    if (resource === "working_hours" && !row) {
      const weekdays = new Set(workingHours.map((item) => Number(item.weekday)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7));
      if (weekdays.size >= 7) {
        setMessage({ type: "error", text: "Все дни недели уже добавлены" });
        return;
      }
    }
    if (resource === "salon_settings" && !row) { void openContactEditor(); return; }
    mediaSelectionRef.current += 1;
    clearMediaPreviews();
    setSiteBlocksMode(false);
    setMapEditorMode(false);
    const next = row ? { ...row } : { ...emptyRecord[resource] };
    if (resource === "salon_settings" && row) {
      // The public/admin API exposes both phone and display_phone. Keep the
      // editable field populated even when a legacy row only has the display
      // value; otherwise reopening the contact form silently shows blanks.
      // Prefer the editable field, but fall back when an older row contains
      // an empty string and keeps the displayed value in its legacy column.
      next.phone = text(row, "phone") || text(row, "display_phone");
      next.email = text(row, "email") || text(row, "contact_email");
      setContactPhone(String(next.phone ?? ""));
      setContactEmail(String(next.email ?? ""));
    }
    if (resource === "services" && categoryId) next.category_id = categoryId;
    const offerRules = resource === "offers" && row ? serviceRules.filter((rule) => String(rule.offer_id) === String(row.id) && active(rule)) : [];
    const conditions = resource === "offers" && row ? offerConditions.filter((condition) => String(condition.offer_id) === String(row.id) && active(condition)).map((condition) => ({ ...condition })) : [];
    const selectedDiscounts = Object.fromEntries(offerRules.map((rule) => [String(rule.service_id), String(number(rule, "discount_amount", 0))]));
    const discountValues = Object.values(selectedDiscounts).filter(Boolean);
    const sameDiscount = discountValues.length > 0 && discountValues.every((value) => value === discountValues[0]);
    conditionDraftsRef.current = conditions;
    setModal(resource); setModalId(row ? String(row.id) : null); setDraft(next); setTiers(parseTiers(next.price_tiers_json)); setMediaFile(null); setPendingMediaFiles({}); setMediaField("front"); setOfferServiceIds(offerRules.map((rule) => String(rule.service_id))); setOfferServiceDiscounts(selectedDiscounts); setCertificateDiscountMode(sameDiscount ? "common" : "individual"); setCommonCertificateDiscount(discountValues[0] ?? "500"); setConditionDrafts(conditions); setMessage(null);
  }

  function setField(key: string, value: unknown) {
    if (key === "phone") setContactPhone(String(value ?? ""));
    if (key === "email") setContactEmail(String(value ?? ""));
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addTier() { setTiers((current) => [...current, { id: createClientId("tier"), label: "", amount: 0 }]); }
  function updateTier(index: number, key: keyof Tier, value: string) {
    setTiers((current) => current.map((tier, tierIndex) => tierIndex === index ? { ...tier, [key]: key === "amount" ? Number(value) : value } : tier));
  }
  function removeTier(index: number) { setTiers((current) => current.filter((_, tierIndex) => tierIndex !== index)); }

  function updateDuration(key: "duration_min_minutes" | "duration_max_minutes", value: string) {
    setDraft((current) => {
      const next = { ...current, [key]: value === "" ? null : Number(value) };
      const min = next.duration_min_minutes;
      const max = next.duration_max_minutes;
      if (typeof min === "number" && Number.isFinite(min)) {
        next.duration_text = typeof max === "number" && Number.isFinite(max) && max > min ? `${min}–${max} минут` : `${min} минут`;
      } else {
        next.duration_text = null;
      }
      return next;
    });
  }
  async function syncOfferRules(offerId: string, offerBody: Row, signal?: AbortSignal) {
    const existing = serviceRules.filter((rule) => String(rule.offer_id) === offerId);
    const selected = new Set(offerServiceIds);
    const isCertificate = offerBody.type === "certificate";
    const defaultDiscountAmount = Number(offerBody.benefit_value ?? 0);
    const defaultRuleType = offerBody.type === "loyalty" ? "free_nth_visit" : defaultDiscountAmount > 0 ? "fixed_discount" : "free";
    const pendingExisting: Promise<Row>[] = [];
    for (const rule of existing) {
      const serviceId = String(rule.service_id);
      if (selected.has(serviceId)) {
        if (isCertificate) {
          // Certificate discounts are per service. Editing the offer must not
          // overwrite the existing amounts with its nominal value (1 000 ₽).
          const amount = certificateDiscountMode === "common" ? Number(commonCertificateDiscount) : Number(offerServiceDiscounts[serviceId] ?? rule.discount_amount ?? 0);
          if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Укажите скидку для услуги «${serviceId}»`);
          pendingExisting.push(api("offer_service_rules", "PATCH", String(rule.id), { is_active: 1, rule_type: "fixed_discount", discount_amount: amount }, signal));
        } else {
          // Keep ordinary offer rules intact while updating the visual copy.
          pendingExisting.push(api("offer_service_rules", "PATCH", String(rule.id), { is_active: 1 }, signal));
        }
        selected.delete(serviceId);
      } else if (active(rule)) {
        pendingExisting.push(api("offer_service_rules", "PATCH", String(rule.id), { is_active: 0 }, signal));
      }
    }
    const pendingNew: Promise<Row>[] = [];
    for (const serviceId of selected) {
      const amount = isCertificate ? (certificateDiscountMode === "common" ? Number(commonCertificateDiscount) : Number(offerServiceDiscounts[serviceId] ?? 0)) : defaultDiscountAmount;
      const ruleType = isCertificate ? "fixed_discount" : defaultRuleType;
      if (ruleType === "fixed_discount" && (!Number.isFinite(amount) || amount <= 0)) throw new Error(`Укажите скидку для услуги «${serviceId}»`);
      pendingNew.push(api("offer_service_rules", "POST", null, { offer_id: offerId, service_id: serviceId, rule_type: ruleType, discount_amount: ruleType === "fixed_discount" ? amount : null, free_visit_number: ruleType === "free_nth_visit" ? 6 : null, usage_limit: 1, is_active: 1, sort_order: 0 }, signal));
    }
    await Promise.all([...pendingExisting, ...pendingNew]);
  }

  async function syncOfferConditions(offerId: string, signal?: AbortSignal) {
    const existing = offerConditions.filter((condition) => String(condition.offer_id) === offerId);
    // Do not manufacture a default condition in the save path. A newly
    // created certificate intentionally starts empty, and deleting the last
    // condition must remain deleted after refresh. Existing rows are loaded
    // into conditionDrafts by openEditor and are preserved normally.
    const sourceDrafts = conditionDraftsRef.current;
    const draftsWithText = sourceDrafts.filter((condition) => text(condition, "description").trim());
    const draftOrder = new Map(draftsWithText.map((condition, index) => [String(condition.id ?? ""), index]));
    const retained = new Set<string>();
    const pendingExisting: Promise<Row>[] = [];
    for (const condition of existing) {
      const draft = draftsWithText.find((item) => String(item.id ?? "") === String(condition.id));
      if (!draft) {
        if (active(condition)) pendingExisting.push(api("offer_conditions", "PATCH", String(condition.id), { is_active: 0 }, signal));
        continue;
      }
      retained.add(String(condition.id));
      pendingExisting.push(api("offer_conditions", "PATCH", String(condition.id), {
        offer_id: offerId,
        condition_type: text(draft, "condition_type", "custom"),
        operator: text(draft, "operator", "custom"),
        amount_value: draft.amount_value === "" || draft.amount_value === null || draft.amount_value === undefined ? null : Number(draft.amount_value),
        description: text(draft, "description").trim(),
        text_value: text(draft, "text_value") || null,
        title: text(draft, "title") || null,
        sort_order: draftOrder.get(String(draft.id ?? "")) ?? 0,
        is_active: 1,
      }, signal));
    }
    const pendingNew: Promise<Row>[] = [];
    for (const draft of draftsWithText) {
      if (draft.id && retained.has(String(draft.id))) continue;
      pendingNew.push(api("offer_conditions", "POST", null, {
        offer_id: offerId,
        condition_type: text(draft, "condition_type", "custom"),
        operator: text(draft, "operator", "custom"),
        amount_value: draft.amount_value === "" || draft.amount_value === null || draft.amount_value === undefined ? null : Number(draft.amount_value),
        description: text(draft, "description").trim(),
        text_value: text(draft, "text_value") || null,
        title: text(draft, "title") || null,
        is_active: 1,
        sort_order: draft.id ? (draftOrder.get(String(draft.id)) ?? 0) : draftsWithText.indexOf(draft),
      }, signal));
    }
    await Promise.all([...pendingExisting, ...pendingNew]);
  }

  function addConditionDraft() {
    setConditionDrafts((current) => {
      const next = [...current, { condition_type: "custom", operator: "custom", amount_value: null, description: "", text_value: "", title: "" }];
      conditionDraftsRef.current = next;
      return next;
    });
  }

  function updateCondition(index: number, key: string, value: unknown) {
    setConditionDrafts((current) => {
      const next = current.map((condition, conditionIndex) => conditionIndex === index ? { ...condition, [key]: value } : condition);
      conditionDraftsRef.current = next;
      return next;
    });
  }

  function removeCondition(index: number) {
    setConditionDrafts((current) => {
      const next = current.filter((_, conditionIndex) => conditionIndex !== index);
      conditionDraftsRef.current = next;
      return next;
    });
  }

  async function reorderItems(resource: EditableResource, rows: Row[], fromId: string, toId: string) {
    if (fromId === toId || operationLockRef.current) return;
    const fromIndex = rows.findIndex((row) => String(row.id) === fromId);
    const toIndex = rows.findIndex((row) => String(row.id) === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...rows];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    operationLockRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      // Persist the rendered order as a compact sequence. The public database reader
      // already orders every collection by sort_order, so this is the single
      // source of truth and does not require exposing a technical sort field.
      await Promise.all(next.map((row, index) => api(resource, "PATCH", String(row.id), { sort_order: index })));
      await refresh(true);
      setMessage({ type: "success", text: "Порядок сохранён" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось изменить порядок" });
    } finally {
      setDraggedItem(null);
      operationLockRef.current = false;
      setBusy(false);
    }
  }

  function dragProps(resource: EditableResource, id: string) {
    return {
      draggable: true,
      onDragStart: (event: React.DragEvent<HTMLElement>) => {
        setDraggedItem({ resource, id });
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
      },
      onDragEnd: () => setDraggedItem(null),
    };
  }

  async function saveEditor() {
    if (!modal || operationLockRef.current) return;
    operationLockRef.current = true;
    const operationController = new AbortController();
    operationAbortRef.current = operationController;
    const operationSignal = operationController.signal;
    setBusy(true); setMessage(null);
    const pendingUploadKeys: string[] = [];
    let savedOfferId = "";
    const previousOffer = modal === "offers" && modalId ? offers.find((offer) => String(offer.id) === String(modalId)) : undefined;
    try {
      if (modal === "external_links" && mapEditorMode) {
        const sourceUrl = text(draft, "source_url").trim();
        if (!sourceUrl) throw new Error("Поле «Ссылка на адрес в Яндекс Картах» обязательно");
        const response = await fetchWithTimeout("/api/admin/map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_url: sourceUrl }), signal: operationSignal });
        const payload = await readJsonWithTimeout<{ error?: string }>(response, ADMIN_REQUEST_TIMEOUT_MS, operationSignal);
        if (!response.ok) throw new Error(payload.error ?? "Не удалось обновить карту");
        await refresh(true, operationSignal); setMessage({ type: "success", text: "Карта обновлена" }); closeEditor(true); return;
      }
      const body: Row = { ...draft };
      if ((modal === "portfolio_items" || modal === "offers") && !modalId) {
        const frontFile = pendingMediaFiles.front ?? (mediaField === "front" ? mediaFile : null);
        const backFile = pendingMediaFiles.back ?? (mediaField === "back" ? mediaFile : null);
        const uploads: Array<{ side: "front" | "back"; file: File }> = [];
        if (modal === "offers") {
          if (frontFile) uploads.push({ side: "front", file: frontFile });
          if (backFile) uploads.push({ side: "back", file: backFile });
        } else if (frontFile) {
          uploads.push({ side: "front", file: frontFile });
        }
        // Stage every selected side before writing the offer row.  allSettled
        // is intentional: if one side fails, the other request is still
        // allowed to finish so its object key is collected and cleaned up.
        const stagedResults = await Promise.allSettled(uploads.map(async ({ side, file }) => {
          const form = new FormData(); form.set("file", file);
          const fieldQuery = modal === "offers" ? `&field=${side}` : "";
          const uploadResponse = await fetchWithTimeout(`/api/admin/media?resource=${modal}${fieldQuery}`, { method: "POST", body: form, signal: operationSignal }, ADMIN_MEDIA_TIMEOUT_MS);
          const uploadPayload = await readJsonWithTimeout<{ storage_key?: string; error?: string }>(uploadResponse, ADMIN_MEDIA_TIMEOUT_MS, operationSignal);
          if (!uploadResponse.ok || !uploadPayload.storage_key) throw new Error(uploadPayload.error ?? "Не удалось загрузить фотографию");
          pendingUploadKeys.push(uploadPayload.storage_key);
          return { side, key: uploadPayload.storage_key };
        }));
        const failedUpload = stagedResults.find((result) => result.status === "rejected");
        if (failedUpload) throw failedUpload.reason instanceof Error ? failedUpload.reason : new Error("Не удалось загрузить фотографию");
        const staged = stagedResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        for (const { side, key } of staged) {
          if (modal === "offers") {
            body[`${side}_storage_key`] = key;
            body[`${side}_url`] = null;
          } else {
            body.image_storage_key = key;
            body.image_url = null;
          }
        }
      }
      if (modal === "services") {
        if (!text(body, "name").trim()) throw new Error("Поле «Название» обязательно");
        if (tiers.length) {
          if (tiers.some((tier) => !tier.label.trim() || !Number.isFinite(tier.amount) || tier.amount < 0)) throw new Error("Проверьте варианты цены");
          body.pricing_type = "tiers"; body.price_tiers_json = JSON.stringify(tiers.map((tier, index) => ({ label: tier.label.trim(), amount: Math.round(tier.amount), sortOrder: index })));
          body.price_min = Math.min(...tiers.map((tier) => tier.amount)); body.price_max = Math.max(...tiers.map((tier) => tier.amount)); body.price_amount = null;
        } else {
          const amount = Number(body.price_amount);
          if (!Number.isFinite(amount) || amount < 0) throw new Error("Поле «Цена» должно быть числом не меньше 0");
          // Switching back from variants must not leave an empty `tiers`
          // pricing model behind; the structured scalar value is canonical.
          if (body.pricing_type !== "from" && body.pricing_type !== "free") body.pricing_type = "fixed";
          body.price_amount = Math.round(amount); body.price_tiers_json = "[]";
        }
        const durationMin = body.duration_min_minutes === null || body.duration_min_minutes === undefined || body.duration_min_minutes === "" ? null : Number(body.duration_min_minutes);
        const durationMax = body.duration_max_minutes === null || body.duration_max_minutes === undefined || body.duration_max_minutes === "" ? null : Number(body.duration_max_minutes);
        if (durationMin !== null && (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 1440)) throw new Error("Поле «Длительность услуги» должно быть от 1 до 1440 минут");
        if (durationMax !== null && (!Number.isInteger(durationMax) || durationMax < 1 || durationMax > 1440 || durationMin === null || durationMax < durationMin)) throw new Error("Проверьте максимальную длительность");
        body.duration_min_minutes = durationMin; body.duration_max_minutes = durationMax;
        if (durationMin === null) body.duration_text = null;
        else if (durationMax !== null && durationMax > durationMin) body.duration_text = `${durationMin}–${durationMax} минут`;
        else body.duration_text = `${durationMin} минут`;
        body.legacy_id = text(body, "legacy_id") || createClientId("service");
        if (!text(body, "category_id")) throw new Error("Поле «Категория» обязательно");
        body.sort_order = modalId ? body.sort_order : 999;
      }
      if (modal === "service_categories") {
        if (!text(body, "title").trim()) throw new Error("Поле «Название» обязательно");
        body.legacy_id = text(body, "legacy_id") || createClientId("category"); body.number = text(body, "number") || "99"; body.short_title = text(body, "short_title") || text(body, "title"); body.price_from_type = text(body, "price_from_type") || "from";
        body.sort_order = modalId ? body.sort_order : 999;
      }
      if (modal === "offers") {
        if (!text(body, "title").trim()) throw new Error("Поле «Название» обязательно");
        if (!text(body, "description").trim()) throw new Error("Поле «Описание» обязательно");
        body.slug = text(body, "slug") || createClientId("offer"); body.type = text(body, "type") || "promotion"; body.currency = "RUB"; body.status = body.status === "hidden" ? "hidden" : "active";
        body.flip_enabled = body.flip_enabled === 1 || body.flip_enabled === true ? 1 : 0;
        if (body.flip_enabled === 1 && !text(body, "back_url") && !text(body, "back_storage_key") && !pendingMediaFiles.back) throw new Error("Добавьте изображение оборотной стороны");
        if (body.type === "certificate") {
          if (!text(body, "linked_service_id")) {
            const certificateService = visibleServices.find((service) => text(service, "name").toLowerCase().includes("сертификат"));
            if (certificateService) body.linked_service_id = String(certificateService.id);
          }
          if (!text(body, "linked_service_id")) throw new Error("Выберите услугу, к которой привязан сертификат");
          body.benefit_type = "nominal"; body.nominal_value = Number(body.nominal_value ?? 1000); body.benefit_value = null;
        } else {
          body.benefit_type = text(body, "benefit_type") || "custom";
        }
        body.sort_order = modalId ? body.sort_order : 999;
      }
      if (modal === "portfolio_items") {
        if (!text(body, "title").trim()) throw new Error("Поле «Название» обязательно");
        // Alt text is maintained automatically from the visible title; it is
        // not a client-facing editing field. Preserve an existing custom alt
        // value, while new records remain accessible without technical input.
        body.alt_text = text(body, "alt_text").trim() || text(body, "title").trim();
        // A new portfolio item must start with an image, but an existing item
        // may intentionally have its image removed from the editor. Keep the
        // record visible (the public card renders a text-only placeholder) and
        // let the cleared media fields persist instead of trapping the user in
        // the modal with a validation error.
        if (!modalId && !text(body, "image_url") && !text(body, "image_storage_key")) throw new Error("Добавьте фотографию");
        body.sort_order = modalId ? body.sort_order : 999;
      }
      if (modal === "masters") {
        if (!text(body, "name").trim()) throw new Error("Поле «Имя» обязательно");
        body.name = text(body, "name").trim();
        body.specialization = text(body, "specialization").trim();
        body.services_text = text(body, "services_text").trim();
        body.sort_order = modalId ? body.sort_order : (masters.length ? Math.max(...masters.map((item) => number(item, "sort_order"))) + 1 : 0);
      }
      if (modal === "salon_settings") {
        if (!text(body, "phone").trim()) throw new Error("Поле «Телефон» обязательно");
        if (!text(body, "street_address").trim()) throw new Error("Поле «Адрес» обязательно");
        body.id = 1;
        body.display_phone = text(body, "phone");
      }
      if (modal === "working_hours") {
        body.specific_date = null;
        const usedWeekdays = new Set(workingHours.filter((row) => String(row.id) !== String(modalId)).map((row) => Number(row.weekday)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7));
        const weekday = modalId ? Number(body.weekday) : [1, 2, 3, 4, 5, 6, 7].find((day) => !usedWeekdays.has(day)) ?? 1;
        if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) throw new Error("Выберите день недели");
        body.weekday = weekday;
        body.is_closed = body.is_closed === 1 || body.is_closed === true ? 1 : 0;
        if (body.is_closed === 0 && (!text(body, "opens_at") || !text(body, "closes_at"))) throw new Error("Укажите время открытия и закрытия");
        body.sort_order = modalId ? body.sort_order : weekday - 1;
      }
      if (modal === "external_links") {
        if (!text(body, "label").trim()) throw new Error("Поле «Название контакта» обязательно");
        if (!text(body, "url").trim()) throw new Error("Поле «Ссылка или адрес» обязательно");
        const contactLabel = text(body, "label").trim().toLowerCase();
        body.kind = contactLabel.includes("max") ? "max" : contactLabel.includes("вконт") || contactLabel.includes("vk") ? "vk" : contactLabel.includes("почт") || contactLabel.includes("email") || contactLabel.includes("e-mail") ? "email" : "other";
        const existingLinkKey = text(body, "link_key");
        body.link_key = !existingLinkKey || (["max", "vk", "email"] as string[]).includes(existingLinkKey) && existingLinkKey !== body.kind
          ? (body.kind === "other" ? createClientId("other") : body.kind)
          : existingLinkKey;
        body.open_in_new_tab = 1;
        body.is_active = body.is_active === 0 ? 0 : 1;
        body.sort_order = modalId ? body.sort_order : (links.length ? Math.max(...links.map((item) => number(item, "sort_order"))) + 1 : 0);
      }
      const saved = await api(modal, modalId ? "PATCH" : "POST", modalId, body, operationSignal);
      if (modal === "offers") savedOfferId = String(saved.id ?? modalId ?? "");
      if (modal === "offers") await Promise.all([syncOfferRules(savedOfferId, body, operationSignal), syncOfferConditions(savedOfferId, operationSignal)]);
      pendingUploadKeys.length = 0; await refresh(true, operationSignal); setMessage({ type: "success", text: "Сохранено" }); closeEditor(true);
    } catch (error) {
      if (modal === "offers" && savedOfferId) {
        const restoreBody = previousOffer
          ? { flip_enabled: previousOffer.flip_enabled, back_storage_key: previousOffer.back_storage_key, back_url: previousOffer.back_url }
          : { flip_enabled: 0, ...(pendingUploadKeys.length ? { front_storage_key: null, front_url: null, back_storage_key: null, back_url: null } : {}) };
        await api("offers", "PATCH", savedOfferId, restoreBody).catch(() => undefined);
      }
      if (pendingUploadKeys.length) {
        const cleanupResource = modal === "offers" ? "offers" : "portfolio_items";
        await Promise.all(pendingUploadKeys.map((key) => fetchWithTimeout(`/api/admin/media?resource=${cleanupResource}&storage_key=${encodeURIComponent(key)}`, { method: "DELETE" }, ADMIN_MEDIA_TIMEOUT_MS).catch(() => undefined)));
      }
      if (modal === "portfolio_items" || modal === "offers") clearMediaPreviews();
      setMediaFile(null);
      setPendingMediaFiles({});
      setMessage({ type: "error", text: error instanceof Error && error.name === "AbortError" ? "Сохранение отменено" : error instanceof Error ? error.message : "Не удалось сохранить изменения" });
    } finally {
      if (operationAbortRef.current === operationController) operationAbortRef.current = null;
      operationLockRef.current = false;
      setBusy(false);
    }
  }

  async function toggleHidden(resource: Resource, row: Row) {
    if (operationLockRef.current) return;
    const label = resource === "offers" ? "акцию" : resource === "portfolio_items" ? "фотографию" : resource === "masters" ? "карточку мастера" : resource === "services" ? "услугу" : resource === "service_categories" ? "категорию" : resource === "working_hours" ? "день графика" : "контакты";
    const isVisible = active(row);
    if (isVisible && !window.confirm(`Скрыть ${label}?`)) return;
    operationLockRef.current = true; setBusy(true);
    try {
      const body: Row = resource === "offers" ? { status: isVisible ? "hidden" : "active" } : { is_active: isVisible ? 0 : 1 };
      await api(resource, "PATCH", String(row.id), body); await refresh(true); setMessage({ type: "success", text: isVisible ? "Скрыто" : "Показано" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось изменить видимость" });
    } finally { operationLockRef.current = false; setBusy(false); }
  }

  async function deleteObject(resource: EditableResource, row: Row) {
    if (operationLockRef.current) return;
    const label = resource === "offers" ? "акцию" : resource === "portfolio_items" ? "фотографию" : resource === "services" ? "услугу" : resource === "service_categories" ? "категорию" : resource === "working_hours" ? "день графика" : resource === "external_links" ? "контакт" : "запись";
    if (!window.confirm(`Удалить ${label} навсегда? Это действие нельзя отменить.`)) return;
    operationLockRef.current = true; setBusy(true); setMessage(null);
    try {
      // Remove managed media before deleting its database record so hard-delete does
      // not leave orphaned objects in Yandex Object Storage. Legacy local
      // /images paths are only cleared from the database and are never touched.
      if (resource === "portfolio_items") {
        const mediaResponse = await fetchWithTimeout(`/api/admin/media?resource=portfolio_items&id=${encodeURIComponent(String(row.id))}`, { method: "DELETE" }, ADMIN_MEDIA_TIMEOUT_MS);
        const mediaPayload = await readJsonWithTimeout<{ error?: string }>(mediaResponse, ADMIN_MEDIA_TIMEOUT_MS);
        if (!mediaResponse.ok) throw new Error(mediaPayload.error ?? "Не удалось удалить изображение");
      } else if (resource === "offers") {
        for (const field of ["front", "back"]) {
          const mediaResponse = await fetchWithTimeout(`/api/admin/media?resource=offers&id=${encodeURIComponent(String(row.id))}&field=${field}`, { method: "DELETE" }, ADMIN_MEDIA_TIMEOUT_MS);
          const mediaPayload = await readJsonWithTimeout<{ error?: string }>(mediaResponse, ADMIN_MEDIA_TIMEOUT_MS);
          if (!mediaResponse.ok) throw new Error(mediaPayload.error ?? "Не удалось удалить изображение акции");
        }
      }
      const response = await fetchWithTimeout(`/api/admin?resource=${encodeURIComponent(resource)}&id=${encodeURIComponent(String(row.id))}&hard=1`, { method: "DELETE" });
      const payload = await readJsonWithTimeout<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload.error ?? "Не удалось удалить запись");
      conditionDraftsRef.current = [];
      await refresh(true); clearMediaPreviews(); setModal(null); setModalId(null); setDraft({}); setMediaFile(null); setConditionDrafts([]); setMessage({ type: "success", text: "Запись удалена" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось удалить запись" });
    } finally { operationLockRef.current = false; setBusy(false); }
  }

  function handleMediaSelected(file: File | null, field: "front" | "back" = mediaField) {
    if (!file) return;
    const selection = ++mediaSelectionRef.current;
    setMediaBusy(true); setMessage(null);
    void (async () => {
      try {
        const normalized = await prepareImageFile(file);
        if (selection !== mediaSelectionRef.current) return;
        const previewKey: MediaPreviewKey = modal === "portfolio_items" ? "portfolio" : field;
        replaceMediaPreview(previewKey, normalized);
        setMediaFile(normalized);
        setPendingMediaFiles((current) => ({ ...current, [field]: normalized }));
        // For an existing record the selected file is the complete action:
        // upload it immediately after normalization so Photos and Files share
        // exactly the same API path.
        if (modalId && (modal === "portfolio_items" || modal === "offers")) {
          await uploadMedia(normalized, field);
        } else {
          setMediaBusy(false);
        }
      } catch (error) {
        if (selection !== mediaSelectionRef.current) return;
        if (mediaInputRef.current) mediaInputRef.current.value = "";
        setMediaFile(null);
        setPendingMediaFiles((current) => ({ ...current, [field]: undefined }));
        replaceMediaPreview(modal === "portfolio_items" ? "portfolio" : field, null);
        setMediaBusy(false);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось подготовить изображение" });
      }
    })();
  }

  async function uploadMedia(selectedFile?: File, selectedField: "front" | "back" = mediaField) {
    if (!modal || modal !== "portfolio_items" && modal !== "offers") return;
    if (operationLockRef.current) return;
    const file = selectedFile ?? mediaFile;
    if (!file) { mediaInputRef.current?.click(); return; }
    if (!modalId) { setMessage({ type: "error", text: "Сначала сохраните запись, затем загрузите фото" }); return; }
    operationLockRef.current = true; setMediaBusy(true); setMessage(null);
    const operationController = new AbortController();
    operationAbortRef.current = operationController;
    try {
      const form = new FormData(); form.set("file", file);
      const mediaQuery = modal === "offers" ? `&field=${selectedField}` : "";
      const response = await fetchWithTimeout(`/api/admin/media?resource=${encodeURIComponent(modal)}&id=${encodeURIComponent(modalId)}${mediaQuery}`, { method: "POST", body: form, signal: operationController.signal }, ADMIN_MEDIA_TIMEOUT_MS); const payload = await readJsonWithTimeout<{ storage_key?: string; error?: string }>(response, ADMIN_MEDIA_TIMEOUT_MS, operationController.signal);
      if (!response.ok || !payload.storage_key) throw new Error(payload.error ?? "Не удалось загрузить фотографию");
      setDraft((current) => modal === "offers"
        ? { ...current, [`${selectedField}_storage_key`]: payload.storage_key, [`${selectedField}_url`]: "" }
        : { ...current, image_storage_key: payload.storage_key, image_url: "" });
      replaceMediaPreview(modal === "portfolio_items" ? "portfolio" : selectedField, null);
      setMediaFile(null); setPendingMediaFiles((current) => ({ ...current, [selectedField]: undefined })); if (mediaInputRef.current) mediaInputRef.current.value = ""; await refresh(true, operationController.signal); setMessage({ type: "success", text: "Фотография загружена" });
    } catch (error) {
      // A rejected file must not remain selected: otherwise the primary
      // button retries the same failed upload and never re-opens the chooser.
      // Clearing both pieces of state lets the client immediately choose a
      // replacement without refreshing the editor.
      if (mediaInputRef.current) mediaInputRef.current.value = "";
      setMediaFile(null);
      setPendingMediaFiles((current) => ({ ...current, [selectedField]: undefined }));
      replaceMediaPreview(modal === "portfolio_items" ? "portfolio" : selectedField, null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось загрузить фотографию" });
    } finally {
      if (operationAbortRef.current === operationController) operationAbortRef.current = null;
      operationLockRef.current = false; setMediaBusy(false);
    }
  }

  function handleSiteMediaSelected(file: File | null, field: "atmosphere" | "award_video") {
    if (!file) return;
    setSiteMediaField(field);
    if (field === "award_video") {
      void uploadSiteMedia(file, field);
      return;
    }
    const selection = ++mediaSelectionRef.current;
    setMediaBusy(true); setMessage(null);
    void (async () => {
      try {
        const normalized = await prepareImageFile(file);
        if (selection !== mediaSelectionRef.current) return;
        replaceMediaPreview("atmosphere", normalized);
        await uploadSiteMedia(normalized, field);
      } catch (error) {
        if (selection !== mediaSelectionRef.current) return;
        if (mediaInputRef.current) mediaInputRef.current.value = "";
        replaceMediaPreview("atmosphere", null);
        setMediaBusy(false);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось подготовить изображение" });
      }
    })();
  }

  async function uploadSiteMedia(file: File, field: "atmosphere" | "award_video") {
    if (modal !== "salon_settings" || !modalId || operationLockRef.current) return;
    operationLockRef.current = true; setMediaBusy(true); setMessage(null);
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetchWithTimeout(`/api/admin/media?resource=salon_settings&id=1&field=${field}`, { method: "POST", body: form }, ADMIN_MEDIA_TIMEOUT_MS);
      const payload = await readJsonWithTimeout<{ item?: Row; storage_key?: string; error?: string }>(response, ADMIN_MEDIA_TIMEOUT_MS);
      if (!response.ok || !payload.storage_key) throw new Error(payload.error ?? "Не удалось загрузить файл");
      const keyName = field === "atmosphere" ? "atmosphere_image_storage_key" : "award_video_storage_key";
      const urlName = field === "atmosphere" ? "atmosphere_image_url" : "award_video_url";
      setDraft((current) => ({ ...current, [keyName]: payload.storage_key, [urlName]: "" }));
      if (field === "atmosphere") replaceMediaPreview("atmosphere", null);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
      await refresh(true);
      setMessage({ type: "success", text: field === "atmosphere" ? "Фотография блока обновлена" : "Видео блока обновлено" });
    } catch (error) {
      if (mediaInputRef.current) mediaInputRef.current.value = "";
      if (field === "atmosphere") replaceMediaPreview("atmosphere", null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось загрузить файл" });
    } finally { operationLockRef.current = false; setMediaBusy(false); }
  }

  async function removeSiteMedia(field: "atmosphere" | "award_video") {
    if (modal !== "salon_settings" || !modalId || operationLockRef.current) return;
    if (!window.confirm(field === "atmosphere" ? "Удалить фотографию блока?" : "Удалить видео блока?")) return;
    operationLockRef.current = true; setMediaBusy(true); setMessage(null);
    try {
      const response = await fetchWithTimeout(`/api/admin/media?resource=salon_settings&id=1&field=${field}`, { method: "DELETE" }, ADMIN_MEDIA_TIMEOUT_MS);
      const payload = await readJsonWithTimeout<{ error?: string }>(response, ADMIN_MEDIA_TIMEOUT_MS);
      if (!response.ok) throw new Error(payload.error ?? "Не удалось удалить файл");
      const keyName = field === "atmosphere" ? "atmosphere_image_storage_key" : "award_video_storage_key";
      const urlName = field === "atmosphere" ? "atmosphere_image_url" : "award_video_url";
      setDraft((current) => ({ ...current, [keyName]: null, [urlName]: "" }));
      await refresh(true);
      setMessage({ type: "success", text: field === "atmosphere" ? "Фотография удалена" : "Видео удалено" });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось удалить файл" }); }
    finally { operationLockRef.current = false; setMediaBusy(false); }
  }

  async function removeMedia(fieldOverride?: "front" | "back") {
    if (!modal || !modalId || (modal !== "portfolio_items" && modal !== "offers")) return;
    if (operationLockRef.current) return;
    const field = fieldOverride ?? mediaField;
    if (modal === "offers" && field === "back" && (draft.flip_enabled === 1 || draft.flip_enabled === true)) {
      setMessage({ type: "error", text: "Сначала выключите переворот карточки" });
      return;
    }
    if (!window.confirm("Удалить фотографию?")) return;
    operationLockRef.current = true; setMediaBusy(true); setMessage(null);
    try {
      const fieldQuery = modal === "offers" ? `&field=${field}` : "";
      const response = await fetchWithTimeout(`/api/admin/media?resource=${encodeURIComponent(modal)}&id=${encodeURIComponent(modalId)}${fieldQuery}`, { method: "DELETE" }, ADMIN_MEDIA_TIMEOUT_MS); const payload = await readJsonWithTimeout<{ error?: string }>(response, ADMIN_MEDIA_TIMEOUT_MS);
      if (!response.ok) throw new Error(payload.error ?? "Не удалось удалить фотографию");
      replaceMediaPreview(modal === "portfolio_items" ? "portfolio" : field, null);
      await refresh(true); setDraft((current) => modal === "offers" ? { ...current, [`${field}_storage_key`]: null, [`${field}_url`]: "" } : { ...current, image_storage_key: null, image_url: "" }); setMessage({ type: "success", text: "Фотография удалена" });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось удалить фотографию" }); } finally { operationLockRef.current = false; setMediaBusy(false); }
  }

  const categoryName = (id: unknown) => text(categories.find((category) => String(category.id) === String(id)), "title", "Без категории");
  const servicesByCategory = (id: unknown) => visibleServices.filter((service) => String(service.category_id) === String(id));
  const contactLinks = links.filter((link) => ["max", "vk", "email", "other"].includes(text(link, "kind")) && !["phone", "email"].includes(text(link, "link_key")));
  const currentImage = modal === "portfolio_items" ? mediaPreviewUrls.portfolio || imageUrl(draft) : modal === "offers" ? mediaPreviewUrls[mediaField] || imageUrl(draft, mediaField) : siteBlocksMode ? mediaPreviewUrls.atmosphere || siteBlockMediaUrl(draft, siteMediaField) : "";

  function field(label: string, control: React.ReactNode, wide = false) {
    return <label className={wide ? "admin-visual-field admin-visual-field--wide" : "admin-visual-field"}><span>{label}</span>{control}</label>;
  }

  function offerMediaPanel(side: "front" | "back") {
    const preview = mediaPreviewUrls[side] || imageUrl(draft, side);
    const pending = pendingMediaFiles[side];
    return <div className="admin-visual-media admin-offer-media" key={side}>
      <strong>{side === "front" ? "Лицевая сторона" : "Оборотная сторона"}</strong>
      {preview ? <img src={preview} alt={side === "front" ? "Лицевая сторона предложения" : "Оборотная сторона предложения"} /> : <div className="admin-visual-media-empty">Изображение не добавлено</div>}
      {pending && <small>Выбрано: {pending.name}</small>}
      <div className="admin-media-controls">
        <button type="button" className="admin-upload-button" disabled={mediaBusy || busy} onClick={() => { setMediaField(side); const input = mediaInputRef.current; if (input) { input.value = ""; input.dataset.mediaField = side; input.click(); } }}>{mediaBusy && mediaField === side ? "Загружается…" : preview ? "Заменить фото" : "Загрузить фото"}</button>
        <button type="button" className="admin-danger" disabled={mediaBusy || busy || !preview || !modalId} onClick={() => { setMediaField(side); void removeMedia(side); }}>Удалить фото</button>
      </div>
      <small>JPEG, PNG или WebP, до 8 МБ.</small>
    </div>;
  }

  function renderModal() {
    if (!modal) return null;
    const title = mapEditorMode ? "Карта" : modalId ? "Изменить" : "Добавить";
    return <div className="admin-visual-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelAndCloseEditor(); }}><section ref={modalRef} className="admin-visual-modal" role="dialog" aria-modal="true" aria-label={`${title} запись`}>
       <div className="admin-visual-modal-head"><div><p className="admin-kicker">Ассоль · Редактирование</p><h2>{title}</h2></div><button type="button" className="admin-icon-button" onClick={cancelAndCloseEditor} aria-label="Закрыть">×</button></div>
       {modal === "service_categories" && <div className="admin-visual-form">{field("Название", <input value={text(draft, "title")} onChange={(event) => setField("title", event.target.value)} autoFocus />)}{field("Короткое название", <input value={text(draft, "short_title")} onChange={(event) => setField("short_title", event.target.value)} />)}{field("Описание", <textarea value={text(draft, "description")} onChange={(event) => setField("description", event.target.value)} />, true)}</div>}
       {modal === "services" && <div className="admin-visual-form">
         {field("Название", <input value={text(draft, "name")} onChange={(event) => setField("name", event.target.value)} autoFocus />)}
         {field("Категория", <select value={text(draft, "category_id")} onChange={(event) => setField("category_id", event.target.value)}><option value="">Без категории</option>{categories.filter(active).map((category) => <option key={String(category.id)} value={String(category.id)}>{text(category, "title")}</option>)}</select>)}
         <div className="admin-price-editor">
           <div className="admin-price-editor-head"><strong>Цена</strong><button type="button" className="admin-text-button" onClick={addTier}>Добавить вариант</button></div>
           {tiers.length > 0 ? <>{tiers.map((tier, index) => <div className="admin-tier-row" key={tier.id}><input aria-label="Название варианта цены" value={tier.label} onChange={(event) => updateTier(index, "label", event.target.value)} /><input aria-label="Цена варианта" type="number" min="0" value={String(tier.amount)} onChange={(event) => updateTier(index, "amount", event.target.value)} /><button type="button" className="admin-icon-button admin-icon-button--small" onClick={() => removeTier(index)} aria-label="Удалить вариант">×</button></div>)}</> : field("Цена, ₽", <input type="number" min="0" value={draft.price_amount === null || draft.price_amount === undefined ? "" : String(draft.price_amount)} onChange={(event) => setField("price_amount", event.target.value)} />)}
           {tiers.length > 0 && <button type="button" className="admin-text-button" onClick={() => setTiers([])}>Вернуться к одной цене</button>}
         </div>
         <div className="admin-duration-editor">
           {field("Длительность услуги, минут", <input type="number" min="1" max="1440" value={draft.duration_min_minutes === null || draft.duration_min_minutes === undefined ? "" : String(draft.duration_min_minutes)} onChange={(event) => updateDuration("duration_min_minutes", event.target.value)} />)}
           {field("Максимальная длительность, минут", <input type="number" min="1" max="1440" value={draft.duration_max_minutes === null || draft.duration_max_minutes === undefined ? "" : String(draft.duration_max_minutes)} onChange={(event) => updateDuration("duration_max_minutes", event.target.value)} />)}
         </div>
       </div>}
       {modal === "masters" && <div className="admin-visual-form">
        {field("Имя", <input value={text(draft, "name")} onChange={(event) => setField("name", event.target.value)} autoFocus />)}
        {field("Специализация", <input value={text(draft, "specialization")} onChange={(event) => setField("specialization", event.target.value)} />)}
        {field("Виды услуг", <textarea value={text(draft, "services_text")} onChange={(event) => setField("services_text", event.target.value)} />, true)}
      </div>}
      {modal === "offers" && <div className="admin-visual-form">
        {field("Название", <input value={text(draft, "title")} onChange={(event) => setField("title", event.target.value)} autoFocus />)}
        {field("Тип предложения", <select value={text(draft, "type") === "certificate" ? "certificate" : "promotion"} onChange={(event) => setField("type", event.target.value)}><option value="promotion">Акция</option><option value="certificate">Сертификат</option></select>)}
        {field("Описание", <textarea value={text(draft, "description")} onChange={(event) => setField("description", event.target.value)} />, true)}
        <label className="admin-checkbox"><input type="checkbox" checked={draft.flip_enabled === 1 || draft.flip_enabled === true} onChange={(event) => setField("flip_enabled", event.target.checked ? 1 : 0)} /><span>Переворачивать карточку</span></label>
        <div className="admin-offer-media-grid">{offerMediaPanel("front")}{(draft.flip_enabled === 1 || draft.flip_enabled === true || imageUrl(draft, "back")) && offerMediaPanel("back")}</div>
        <input id="admin-media-file-input" ref={mediaInputRef} data-media-field={mediaField} className="admin-file-input admin-file-input--hidden" type="file" accept="image/*" disabled={mediaBusy || busy} onChange={(event) => { const field = event.currentTarget.dataset.mediaField === "back" ? "back" : "front"; handleMediaSelected(event.target.files?.[0] ?? null, field); }} />
        {text(draft, "type") !== "certificate" ? <>
          {field("Текст на значке", <input value={text(draft, "short_title")} onChange={(event) => setField("short_title", event.target.value)} />)}
          {field("Что показать вместо цены", <input value={text(draft, "eyebrow")} onChange={(event) => setField("eyebrow", event.target.value)} />)}
        </> : <>
          {field("Номинал сертификата, ₽", <input type="number" min="0" value={draft.nominal_value === null || draft.nominal_value === undefined ? "1000" : String(draft.nominal_value)} onChange={(event) => setField("nominal_value", event.target.value)} />)}
          <div className="admin-offer-services"><strong>Как применяется скидка?</strong><label className="admin-checkbox"><input type="radio" name="certificate-discount-mode" checked={certificateDiscountMode === "common"} onChange={() => setCertificateDiscountMode("common")} /><span>Одинаковая скидка на выбранные услуги</span></label>{certificateDiscountMode === "common" && field("Значение на значке, ₽", <input type="number" min="1" value={commonCertificateDiscount} onChange={(event) => setCommonCertificateDiscount(event.target.value)} />)}<label className="admin-checkbox"><input type="radio" name="certificate-discount-mode" checked={certificateDiscountMode === "individual"} onChange={() => setCertificateDiscountMode("individual")} /><span>Индивидуальная скидка для каждой услуги</span></label></div>
        </>}
        <div className="admin-offer-services"><strong>{text(draft, "type") === "certificate" ? "Услуги сертификата" : "Услуги по акции"}</strong><p>Отмеченные услуги получат специальный значок. При нажатии на него обычная цена заменится указанным предложением.</p><div className="admin-offer-service-options">{visibleServices.map((service) => { const serviceId = String(service.id); const selected = offerServiceIds.includes(serviceId); return <label key={serviceId}><input type="checkbox" checked={selected} onChange={(event) => setOfferServiceIds((current) => event.target.checked ? [...current, serviceId] : current.filter((id) => id !== serviceId))} /><span>{text(service, "name")} <small>{categoryName(service.category_id)}</small></span>{text(draft, "type") === "certificate" && certificateDiscountMode === "individual" && selected && <input aria-label={`Скидка для услуги ${text(service, "name")}`} type="number" min="1" value={offerServiceDiscounts[serviceId] ?? ""} onChange={(event) => setOfferServiceDiscounts((current) => ({ ...current, [serviceId]: event.target.value }))} />}</label>; })}</div></div>
        {text(draft, "type") === "certificate" && <div className="admin-offer-conditions"><div className="admin-price-editor-head"><strong>Условия сертификата</strong><button type="button" className="admin-text-button" onClick={addConditionDraft}>Добавить условие</button></div><p>Эти условия показываются клиенту вместе с сертификатом.</p>{conditionDrafts.map((condition, index) => <div className="admin-condition-row" key={String(condition.id ?? `new-${index}`)}><textarea aria-label="Условие сертификата" placeholder="Например: скидка используется один раз" value={text(condition, "description")} onChange={(event) => updateCondition(index, "description", event.target.value)} /><button type="button" className="admin-icon-button admin-icon-button--small" onClick={() => removeCondition(index)} aria-label="Удалить условие">×</button></div>)}</div>}
      </div>}
      {modal === "portfolio_items" && <div className="admin-visual-form">{field("Подпись", <input value={text(draft, "title")} onChange={(event) => setField("title", event.target.value)} autoFocus />)}{field("Описание работы", <textarea value={text(draft, "description")} onChange={(event) => setField("description", event.target.value)} />, true)}{field("Категория", <select value={text(draft, "service_category_id")} onChange={(event) => setField("service_category_id", event.target.value || null)}><option value="">Без категории</option>{categories.filter(active).map((category) => <option key={String(category.id)} value={String(category.id)}>{text(category, "title")}</option>)}</select>)}<div className="admin-visual-media">{currentImage ? <img src={currentImage} alt={text(draft, "alt_text", text(draft, "title", "Текущее изображение"))} /> : <div className="admin-visual-media-empty">Выберите фотографию</div>}<div className="admin-media-controls"><input id="admin-media-file-input" ref={mediaInputRef} className="admin-file-input admin-file-input--hidden" type="file" accept="image/*" disabled={mediaBusy || busy} onChange={(event) => handleMediaSelected(event.target.files?.[0] ?? null)} />{mediaFile ? <button type="button" className="admin-upload-button" disabled={mediaBusy || busy} onClick={() => void (modalId ? uploadMedia() : saveEditor())}>{mediaBusy || busy ? "Загружается…" : modalId ? "Загрузить фото" : "Сохранить с фото"}</button> : <label htmlFor="admin-media-file-input" className="admin-upload-button" aria-disabled={mediaBusy || busy}>{mediaBusy || busy ? "Загружается…" : "Загрузить фото"}</label>}<button type="button" className="admin-danger" disabled={mediaBusy || busy || !currentImage || !modalId} onClick={() => void removeMedia()}>Удалить фото</button></div><small>JPEG, PNG или WebP, до 8 МБ. Старое локальное изображение не удаляется.</small></div></div>}
      {modal === "external_links" && (mapEditorMode
         ? <div className="admin-visual-form">{field("Ссылка на адрес в Яндекс Картах", <input type="url" value={text(draft, "source_url")} onChange={(event) => setField("source_url", event.target.value)} placeholder="https://yandex.ru/maps/..." autoFocus />, true)}<p className="admin-form-note">Вставьте ссылку на адрес или короткую ссылку из Яндекс Карт. Положение метки и центрирование для компьютера и телефона настроятся автоматически.</p></div>
        : <div className="admin-visual-form">{field("Название контакта", <input value={text(draft, "label")} onChange={(event) => setField("label", event.target.value)} autoFocus />)}{field("Ссылка или адрес", <input value={text(draft, "url")} onChange={(event) => setField("url", event.target.value)} />, true)}{field("Номер для копирования", <input type="tel" value={text(draft, "phone_to_copy")} onChange={(event) => setField("phone_to_copy", event.target.value)} />)}</div>)}
      {modal === "salon_settings" && (siteBlocksMode ? <div className="admin-visual-form">
        {field("Надпись награды", <input value={text(draft, "award_eyebrow", "Яндекс · 2026")} onChange={(event) => setField("award_eyebrow", event.target.value)} autoFocus />)}
        {field("Заголовок награды", <input value={text(draft, "award_title", "«Хорошее место» — благодаря вам")} onChange={(event) => setField("award_title", event.target.value)} />)}
        {field("Текст награды", <textarea value={text(draft, "award_description")} onChange={(event) => setField("award_description", event.target.value)} />, true)}
        <div className="admin-visual-media admin-site-block-media"><strong>Видео награды</strong>{siteBlockMediaUrl(draft, "award_video") ? <video src={siteBlockMediaUrl(draft, "award_video")} controls muted preload="metadata" /> : <div className="admin-visual-media-empty">Видео не добавлено</div>}<div className="admin-media-controls"><input id="admin-site-video-input" ref={mediaInputRef} className="admin-file-input admin-file-input--hidden" type="file" accept="video/mp4,video/webm" disabled={mediaBusy || busy} onChange={(event) => handleSiteMediaSelected(event.target.files?.[0] ?? null, "award_video")} /><label htmlFor="admin-site-video-input" className="admin-upload-button">{mediaBusy && siteMediaField === "award_video" ? "Загружается…" : "Заменить видео"}</label><button type="button" className="admin-danger" disabled={mediaBusy || busy || !text(draft, "award_video_storage_key")} onClick={() => void removeSiteMedia("award_video")}>Удалить видео</button></div><small>MP4 или WebM, до 50 МБ.</small></div>
        <div className="admin-visual-media admin-site-block-media"><strong>Фото блока «В салоне»</strong>{(mediaPreviewUrls.atmosphere || siteBlockMediaUrl(draft, "atmosphere")) ? <img src={mediaPreviewUrls.atmosphere || siteBlockMediaUrl(draft, "atmosphere")} alt="Текущее фото блока «В салоне»" /> : <div className="admin-visual-media-empty">Фотография не добавлена</div>}<div className="admin-media-controls"><input id="admin-site-atmosphere-input" ref={mediaInputRef} className="admin-file-input admin-file-input--hidden" type="file" accept="image/*" disabled={mediaBusy || busy} onChange={(event) => handleSiteMediaSelected(event.target.files?.[0] ?? null, "atmosphere")} /><label htmlFor="admin-site-atmosphere-input" className="admin-upload-button">{mediaBusy && siteMediaField === "atmosphere" ? "Загружается…" : "Заменить фото"}</label><button type="button" className="admin-danger" disabled={mediaBusy || busy || !text(draft, "atmosphere_image_storage_key")} onClick={() => void removeSiteMedia("atmosphere")}>Удалить фото</button></div><small>JPEG, PNG или WebP, до 8 МБ.</small></div>
      </div> : <div className="admin-visual-form">{field("Название салона", <input value={text(draft, "salon_name")} onChange={(event) => setField("salon_name", event.target.value)} />)}{field("Телефон", <input value={contactPhone} onChange={(event) => setField("phone", event.target.value)} autoFocus />)}{field("Email", <input value={contactEmail} onChange={(event) => setField("email", event.target.value)} />)}{field("Адрес", <textarea value={text(draft, "street_address")} onChange={(event) => setField("street_address", event.target.value)} />, true)}</div>)}
      {modal === "working_hours" && <div className="admin-visual-form"><label className="admin-checkbox"><input type="checkbox" checked={draft.is_closed === 1} onChange={(event) => setField("is_closed", event.target.checked ? 1 : 0)} /><span>Выходной день</span></label>{draft.is_closed !== 1 && <div className="admin-duration-editor">{field("Открытие", <input type="time" value={text(draft, "opens_at")} onChange={(event) => setField("opens_at", event.target.value)} />)}{field("Закрытие", <input type="time" value={text(draft, "closes_at")} onChange={(event) => setField("closes_at", event.target.value)} />)}</div>}</div>}
      <div className="admin-visual-modal-actions"><button type="button" className="button" disabled={busy || mediaBusy} onClick={() => void saveEditor()}>{busy ? "Сохраняем…" : "Сохранить"}</button><button type="button" className="admin-secondary" onClick={cancelAndCloseEditor}>{busy || mediaBusy ? "Отменить" : "Отмена"}</button>{modalId && modal !== "salon_settings" && modal !== "working_hours" && !mapEditorMode && <button type="button" className="admin-danger admin-delete-record" disabled={busy || mediaBusy} onClick={() => void deleteObject(modal, { id: modalId })}>Удалить запись</button>}</div>
    </section></div>;
  }

  return <main className="admin-visual-page"><header className="admin-visual-header"><div><p className="admin-kicker">Ассоль · Редактирование сайта</p><h1>Ваш салон</h1><p>Меняйте только то, что видят ваши гости. Нажмите «Изменить» рядом с нужным блоком.</p></div><div className="admin-visual-header-actions"><button type="button" className={`admin-secondary ${showHidden ? "is-active" : ""}`} onClick={() => setShowHidden((value) => !value)}>{showHidden ? "Скрытые показаны" : "Показывать скрытые"}</button><button type="button" className="admin-secondary" disabled={logoutBusy} onClick={() => void logout()}>{logoutBusy ? "Выходим…" : "Выйти"}</button><Link prefetch={false} className="admin-back" href="/">Вернуться на сайт ↗</Link></div></header>{message && <p className={`admin-message admin-visual-toast admin-message--${message.type}`} role="status">{message.text}</p>}{loading ? <p className="admin-visual-loading">Загружаем содержимое сайта…</p> : <div className="admin-visual-content">
    <section className="admin-visual-section" id="admin-categories"><div className="admin-visual-section-head"><div><p className="admin-kicker">01 · Каталог</p><h2>Категории услуг</h2><p className="admin-reorder-hint">Перетащите карточку или услугу, чтобы изменить порядок.</p></div><button type="button" className="button" onClick={() => openEditor("service_categories")}>+ Добавить категорию</button></div><div className="admin-category-grid">{visibleCategories.map((category) => { const categoryServices = servicesByCategory(category.id); return <article className={`admin-category-card ${active(category) ? "" : "is-hidden"} ${draggedItem?.id === String(category.id) ? "is-dragging" : ""}`} key={String(category.id)} {...dragProps("service_categories", String(category.id))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedItem?.resource === "service_categories") void reorderItems("service_categories", visibleCategories, draggedItem.id, String(category.id)); }}><div className="admin-card-head"><div><h3>{text(category, "title")}</h3><p>{text(category, "description")}</p></div><span className="admin-card-status">{active(category) ? "Видно на сайте" : "Скрыто"}</span></div><div className="admin-service-list">{categoryServices.map((service) => <div className={`admin-service-row ${active(service) ? "" : "is-hidden"} ${draggedItem?.id === String(service.id) ? "is-dragging" : ""}`} key={String(service.id)} {...dragProps("services", String(service.id))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedItem?.resource === "services") void reorderItems("services", categoryServices, draggedItem.id, String(service.id)); }}><div><strong>{text(service, "name")}</strong><span>{priceLabel(service)}</span></div><div className="admin-inline-actions"><button type="button" className="admin-text-button" onClick={(event) => { event.stopPropagation(); openEditor("services", service); }}>Изменить</button><button type="button" className="admin-text-button" onClick={(event) => { event.stopPropagation(); void toggleHidden("services", service); }}>{active(service) ? "Скрыть" : "Показать"}</button><button type="button" className="admin-danger admin-text-button" onClick={(event) => { event.stopPropagation(); void deleteObject("services", service); }}>Удалить</button></div></div>)}<button type="button" className="admin-add-inline" onClick={() => openEditor("services", undefined, String(category.id))}>+ Добавить услугу</button></div><div className="admin-card-actions"><button type="button" className="admin-secondary" onClick={(event) => { event.stopPropagation(); openEditor("service_categories", category); }}>Изменить категорию</button><button type="button" className="admin-text-button" onClick={(event) => { event.stopPropagation(); void toggleHidden("service_categories", category); }}>{active(category) ? "Скрыть категорию" : "Показать категорию"}</button><button type="button" className="admin-danger admin-text-button" onClick={(event) => { event.stopPropagation(); void deleteObject("service_categories", category); }}>Удалить</button></div></article>; })}</div></section>
    <section className="admin-visual-section" id="admin-offers"><div className="admin-visual-section-head"><div><p className="admin-kicker">02 · Сейчас в салоне</p><h2>Акции и предложения</h2><p className="admin-reorder-hint">Перетащите карточки, чтобы изменить порядок показа.</p></div><button type="button" className="button" onClick={() => openEditor("offers")}>+ Добавить акцию</button></div><div className="admin-offer-grid">{visibleOffers.map((offer) => <article className={`admin-offer-card ${active(offer) ? "" : "is-hidden"} ${draggedItem?.id === String(offer.id) ? "is-dragging" : ""}`} key={String(offer.id)} {...dragProps("offers", String(offer.id))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedItem?.resource === "offers") void reorderItems("offers", visibleOffers, draggedItem.id, String(offer.id)); }}>{imageUrl(offer, "front") && <img src={imageUrl(offer, "front")} alt={text(offer, "title")} />}<div className="admin-offer-card-copy"><span className="admin-kicker">{text(offer, "short_title", "Предложение")}</span><h3>{text(offer, "title")}</h3><p>{text(offer, "description")}</p><div className="admin-inline-actions"><button type="button" className="admin-secondary" onClick={(event) => { event.stopPropagation(); openEditor("offers", offer); }}>Изменить</button><button type="button" className="admin-text-button" onClick={(event) => { event.stopPropagation(); void toggleHidden("offers", offer); }}>{active(offer) ? "Скрыть" : "Показать"}</button><button type="button" className="admin-danger admin-text-button" onClick={(event) => { event.stopPropagation(); void deleteObject("offers", offer); }}>Удалить</button></div></div></article>)}</div></section>
    <section className="admin-visual-section" id="admin-hours"><div className="admin-visual-section-head"><div><p className="admin-kicker">03 · График</p><h2>Часы работы</h2><p className="admin-reorder-hint">Дни недели фиксированы. Можно изменить только время работы.</p></div></div><div className="admin-hours-grid">{fixedWorkingHours.map((row) => <article className="admin-hour-card" key={String(row.id)}><div><strong>{["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"][number(row, "weekday")] || "День недели"}</strong><span>{row.is_closed === 1 ? "Выходной" : `${text(row, "opens_at")}–${text(row, "closes_at")}`}</span></div><div className="admin-inline-actions"><button type="button" className="admin-text-button" onClick={() => openEditor("working_hours", row)}>Изменить</button></div></article>)}</div></section>
    <section className="admin-visual-section" id="admin-portfolio"><div className="admin-visual-section-head"><div><p className="admin-kicker">04 · Работы</p><h2>Портфолио</h2><p className="admin-reorder-hint">Перетащите работу, чтобы изменить порядок.</p></div><button type="button" className="button" onClick={() => openEditor("portfolio_items")}>+ Добавить фото</button></div><div className="admin-portfolio-grid">{visiblePortfolio.map((item) => <article className={`admin-portfolio-card ${active(item) ? "" : "is-hidden"} ${draggedItem?.id === String(item.id) ? "is-dragging" : ""}`} key={String(item.id)} {...dragProps("portfolio_items", String(item.id))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedItem?.resource === "portfolio_items") void reorderItems("portfolio_items", visiblePortfolio, draggedItem.id, String(item.id)); }}>{imageUrl(item) ? <img src={imageUrl(item)} alt={text(item, "alt_text", text(item, "title"))} /> : <div className="admin-visual-media-empty">Нет изображения</div>}<div><strong>{text(item, "title")}</strong><span>{categoryName(item.service_category_id)}</span><div className="admin-inline-actions"><button type="button" className="admin-text-button" onClick={(event) => { event.stopPropagation(); openEditor("portfolio_items", item); }}>Изменить фото</button><button type="button" className="admin-text-button" onClick={(event) => { event.stopPropagation(); void toggleHidden("portfolio_items", item); }}>{active(item) ? "Скрыть" : "Показать"}</button><button type="button" className="admin-danger admin-text-button" onClick={(event) => { event.stopPropagation(); void deleteObject("portfolio_items", item); }}>Удалить</button></div></div></article>)}</div></section>
    <section className="admin-visual-section admin-contacts-section" id="admin-contacts"><div className="admin-visual-section-head"><div><p className="admin-kicker">05 · Контакты</p><h2>Контакты салона</h2></div><div className="admin-inline-actions"><button type="button" className="button" onClick={() => void openContactEditor()}>Изменить контакты</button><button type="button" className="admin-secondary" onClick={openMapEditor}>Изменить карту</button><button type="button" className="admin-secondary" onClick={() => openEditor("external_links")}>+ Добавить контакт</button></div></div><div className="admin-contact-card"><div><span>Телефон</span><strong>{text(contacts, "display_phone", text(contacts, "phone", "Не указан"))}</strong></div><div><span>Email</span><strong>{text(contacts, "email", "Не указан")}</strong></div><div><span>Адрес</span><strong>{[text(contacts, "region"), text(contacts, "city"), text(contacts, "street_address")].filter(Boolean).join(", ") || "Не указан"}</strong></div></div><div className="admin-contact-links">{contactLinks.map((link) => <article key={String(link.id)} className={!active(link) ? "is-hidden" : ""}><div><span>{text(link, "label", "Контакт")}</span><strong>{text(link, "url")}</strong></div><div className="admin-inline-actions"><button type="button" className="admin-text-button" onClick={() => openEditor("external_links", link)}>Изменить</button><button type="button" className="admin-text-button" onClick={() => void toggleHidden("external_links", link)}>{active(link) ? "Скрыть" : "Показать"}</button><button type="button" className="admin-danger admin-text-button" onClick={() => void deleteObject("external_links", link)}>Удалить</button></div></article>)}</div></section>
    <section className="admin-visual-section" id="admin-site-blocks"><div className="admin-visual-section-head"><div><p className="admin-kicker">06 · Блоки сайта</p><h2>Награда и атмосфера</h2><p className="admin-reorder-hint">Редактируйте текст награды и медиа, не меняя ссылку на Яндекс Карты.</p></div><button type="button" className="button" onClick={() => void openSiteBlocksEditor()}>Изменить блоки</button></div><div className="admin-contact-card admin-site-block-summary"><div><span>{text(contacts, "award_eyebrow", "Яндекс · 2026")}</span><strong>{text(contacts, "award_title", "«Хорошее место» — благодаря вам")}</strong></div><div><span>Фото «В салоне»</span><strong>{text(contacts, "atmosphere_image_storage_key") ? "Загружено в Object Storage" : "Стандартное изображение"}</strong></div><div><span>Видео награды</span><strong>{text(contacts, "award_video_storage_key") ? "Загружено в Object Storage" : "Стандартное видео"}</strong></div></div></section>
    <section className="admin-visual-section" id="admin-masters"><div className="admin-visual-section-head"><div><p className="admin-kicker">07 · Команда</p><h2>Мастера</h2><p>Редактируйте имя, специализацию и виды услуг.</p></div><button type="button" className="button" onClick={() => openEditor("masters")}>+ Добавить мастера</button></div><div className="admin-master-grid">{visibleMasters.map((master) => <article className={`admin-master-card ${active(master) ? "" : "is-hidden"} ${draggedItem?.id === String(master.id) ? "is-dragging" : ""}`} key={String(master.id)} {...dragProps("masters", String(master.id))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedItem?.resource === "masters") void reorderItems("masters", visibleMasters, draggedItem.id, String(master.id)); }}><span className="admin-master-initial">{text(master, "name").trim().charAt(0) || "М"}</span><div><h3>{text(master, "name", "Без имени")}</h3><p>{text(master, "specialization")}</p><small>{text(master, "services_text")}</small><div className="admin-inline-actions"><button type="button" className="admin-secondary" onClick={(event) => { event.stopPropagation(); openEditor("masters", master); }}>Изменить</button><button type="button" className="admin-text-button" onClick={(event) => { event.stopPropagation(); void toggleHidden("masters", master); }}>{active(master) ? "Скрыть" : "Показать"}</button><button type="button" className="admin-danger admin-text-button" onClick={(event) => { event.stopPropagation(); void deleteObject("masters", master); }}>Удалить</button></div></div></article>)}</div></section>
  </div>}{renderModal()}</main>;
}
