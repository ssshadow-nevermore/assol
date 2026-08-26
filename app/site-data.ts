import type { CatalogBenefit, CatalogCategory, CatalogItem } from "./services-data";
import { resolveMediaUrl } from "./media-url";
import { formatCategoryPriceFromServices, formatStoredPrice } from "./price-utils";
import { getSqliteDatabase } from "../db/sqlite";
import type { SqliteDatabase } from "../db/sqlite";
import type {
  PortfolioWork,
  SiteData,
  SiteExternalLink,
  SiteOffer,
  SiteOfferCondition,
  SiteOfferRule,
  SiteMaster,
  SiteWorkingHours,
} from "./site-data-types";

type CategoryRow = {
  id: string;
  legacy_id: string;
  number: string;
  title: string;
  short_title: string;
  description: string;
  price_from_type: string;
  price_from_amount: number | null;
  price_from_min: number | null;
  price_from_max: number | null;
  price_from_display_text: string | null;
  price_note: string | null;
  master_ids_json: string;
  sort_order: number;
};

type ServiceRow = {
  id: string;
  category_id: string;
  legacy_id: string;
  name: string;
  note: string | null;
  pricing_type: string;
  price_amount: number | null;
  price_min: number | null;
  price_max: number | null;
  price_tiers_json: string;
  price_display_text: string | null;
  duration_text: string | null;
  sort_order: number;
};

type SalonRow = {
  salon_name: string;
  phone: string;
  display_phone: string;
  email: string | null;
  region: string | null;
  city: string | null;
  street_address: string;
  latitude: number | null;
  longitude: number | null;
  yandex_organization_id: string | null;
  logo_url: string | null;
  award_eyebrow: string | null;
  award_title: string | null;
  award_description: string | null;
  award_video_storage_key: string | null;
  award_video_url: string | null;
  atmosphere_image_storage_key: string | null;
  atmosphere_image_url: string | null;
};

type WorkingHoursRow = {
  id: string;
  weekday: number | null;
  specific_date: string | null;
  is_closed: number;
  opens_at: string | null;
  closes_at: string | null;
  note: string | null;
  sort_order: number;
};

type MasterRow = {
  id: string;
  name: string;
  specialization: string;
  services_text: string;
  image_url: string | null;
  image_storage_key: string | null;
  sort_order: number;
};

type ExternalLinkRow = {
  id: string;
  link_key: string;
  kind: string;
  label: string;
  url: string;
  phone_to_copy: string | null;
  open_in_new_tab: number;
  sort_order: number;
};

type PortfolioRow = {
  id: string;
  service_category_id: string | null;
  title: string;
  description: string | null;
  alt_text: string;
  image_url: string | null;
  image_storage_key: string | null;
  sort_order: number;
};

type OfferRow = {
  id: string;
  linked_service_id: string | null;
  type: SiteOffer["type"];
  slug: string;
  title: string;
  short_title: string | null;
  eyebrow: string | null;
  description: string;
  legal_note: string | null;
  benefit_type: string;
  benefit_value: number | null;
  nominal_value: number | null;
  free_visit_number: number | null;
  front_url: string | null;
  front_storage_key: string | null;
  back_url: string | null;
  back_storage_key: string | null;
  flip_enabled: number;
  is_transferable: number;
  can_combine_with_other_offers: number;
  sort_order: number;
};

type OfferConditionRow = {
  id: string;
  offer_id: string;
  condition_type: string;
  operator: string;
  amount_value: number | null;
  text_value: string | null;
  title: string | null;
  description: string;
  sort_order: number;
};

type OfferRuleRow = {
  id: string;
  offer_id: string;
  service_id: string;
  rule_type: SiteOfferRule["ruleType"];
  discount_amount: number | null;
  discount_percent: number | null;
  free_visit_number: number | null;
  usage_limit: number | null;
  shared_usage_group: string | null;
  sort_order: number;
};

function parseMasterIds(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function formatHours(rows: SiteWorkingHours[]): string {
  const recurring = rows.filter((row) => row.weekday !== null && !row.specificDate && !row.isClosed);
  if (
    recurring.length === 7 &&
    recurring.every((row) => row.opensAt === recurring[0]?.opensAt && row.closesAt === recurring[0]?.closesAt)
  ) {
    return `Ежедневно · ${recurring[0].opensAt}–${recurring[0].closesAt}`;
  }
  return "График уточняйте у администратора";
}

async function allRows<T extends Record<string, unknown>>(database: SqliteDatabase, query: string): Promise<T[]> {
  const result = await database.prepare(query).all<T>();
  return result.results;
}

async function loadFromDatabase(database: SqliteDatabase): Promise<SiteData> {
  const [categoryRows, serviceRows, salonRows, hoursRows, linkRows, portfolioRows, offerRows, conditionRows, ruleRows, masterRows] = await Promise.all([
    allRows<CategoryRow>(database, "SELECT id, legacy_id, number, title, short_title, description, price_from_type, price_from_amount, price_from_min, price_from_max, price_from_display_text, price_note, master_ids_json, sort_order FROM service_categories WHERE is_active = 1 ORDER BY sort_order, number"),
    allRows<ServiceRow>(database, "SELECT id, category_id, legacy_id, name, note, pricing_type, price_amount, price_min, price_max, price_tiers_json, price_display_text, duration_text, sort_order FROM services WHERE is_active = 1 ORDER BY category_id, sort_order"),
    allRows<SalonRow>(database, "SELECT salon_name, phone, display_phone, email, region, city, street_address, latitude, longitude, yandex_organization_id, logo_url, award_eyebrow, award_title, award_description, award_video_storage_key, award_video_url, atmosphere_image_storage_key, atmosphere_image_url FROM salon_settings WHERE id = 1 AND is_active = 1"),
    allRows<WorkingHoursRow>(database, "SELECT id, weekday, specific_date, is_closed, opens_at, closes_at, note, sort_order FROM working_hours WHERE is_active = 1 ORDER BY sort_order"),
    allRows<ExternalLinkRow>(database, "SELECT id, link_key, kind, label, url, phone_to_copy, open_in_new_tab, sort_order FROM external_links WHERE is_active = 1 ORDER BY sort_order"),
    allRows<PortfolioRow>(database, "SELECT id, service_category_id, title, description, alt_text, image_url, image_storage_key, sort_order FROM portfolio_items WHERE is_active = 1 ORDER BY sort_order"),
    allRows<OfferRow>(database, "SELECT id, linked_service_id, type, slug, title, short_title, eyebrow, description, legal_note, benefit_type, benefit_value, nominal_value, free_visit_number, front_url, front_storage_key, back_url, back_storage_key, flip_enabled, is_transferable, can_combine_with_other_offers, sort_order FROM offers WHERE status = 'active' ORDER BY sort_order"),
    allRows<OfferConditionRow>(database, "SELECT id, offer_id, condition_type, operator, amount_value, text_value, title, description, sort_order FROM offer_conditions WHERE is_active = 1 ORDER BY offer_id, sort_order"),
    allRows<OfferRuleRow>(database, "SELECT id, offer_id, service_id, rule_type, discount_amount, discount_percent, free_visit_number, usage_limit, shared_usage_group, sort_order FROM offer_service_rules WHERE is_active = 1 ORDER BY offer_id, sort_order"),
    allRows<MasterRow>(database, "SELECT id, name, specialization, services_text, image_url, image_storage_key, sort_order FROM masters WHERE is_active = 1 ORDER BY sort_order, id"),
  ]);

  const salonRow = salonRows[0];
  if (!salonRow || categoryRows.length === 0) {
    throw new Error("SQLite site content is incomplete");
  }

  const rulesByService = new Map<string, OfferRuleRow[]>();
  for (const rule of ruleRows) {
    const current = rulesByService.get(rule.service_id) ?? [];
    current.push(rule);
    rulesByService.set(rule.service_id, current);
  }
  const offerById = new Map(offerRows.map((offer) => [offer.id, offer]));
  const servicesByCategory = new Map<string, CatalogItem[]>();
  const servicePriceRowsByCategory = new Map<string, ServiceRow[]>();
  for (const service of serviceRows) {
    const current = servicePriceRowsByCategory.get(service.category_id) ?? [];
    current.push(service);
    servicePriceRowsByCategory.set(service.category_id, current);
  }
  for (const service of serviceRows) {
    const benefitRules = rulesByService.get(service.id) ?? [];
    const benefits = benefitRules.flatMap((rule): CatalogBenefit[] => {
      const offer = offerById.get(rule.offer_id);
      if (!offer) return [];
      const type = offer.type;
      if (type === "loyalty" && rule.rule_type === "free_nth_visit") {
        return [{
          id: rule.id,
          offerId: offer.id,
          type,
          label: offer.short_title || offer.title || "6-я бесплатно",
          priceText: offer.eyebrow || "6-я услуга — бесплатно",
          ruleType: rule.rule_type,
        }];
      }
      if (type === "certificate" && rule.rule_type === "fixed_discount" && Number(rule.discount_amount) > 0) {
        const discountAmount = Number(rule.discount_amount);
        return [{
          id: rule.id,
          offerId: offer.id,
          type,
          label: `Сертификат −${discountAmount} ₽`,
          // The price is calculated in the client component from the service
          // label so ranges and zero-flooring remain consistent everywhere.
          priceText: "",
          discountAmount,
          ruleType: rule.rule_type,
        }];
      }
      if (type !== "loyalty" && type !== "certificate") {
        return [{
          id: rule.id,
          offerId: offer.id,
          type,
          label: offer.short_title || offer.title || "Спецпредложение",
          priceText: offer.eyebrow || "Уточните условия акции",
          ruleType: rule.rule_type,
        }];
      }
      return [];
    });
    const loyaltyBenefit = benefits.find((benefit) => benefit.type === "loyalty");
    const certificateBenefit = benefits.find((benefit) => benefit.type === "certificate");
    const promotionBenefit = benefits.find((benefit) => benefit.type !== "loyalty" && benefit.type !== "certificate");
    const item: CatalogItem = {
      id: service.legacy_id,
      name: service.name,
      price: formatStoredPrice(service),
      duration: service.duration_text ?? undefined,
      note: service.note ?? undefined,
      loyaltyEligible: Boolean(loyaltyBenefit) || undefined,
      certificateDiscount: certificateBenefit?.discountAmount,
      promotionLabel: promotionBenefit?.label,
      // Keep the badge copy and the replacement-price copy independent. The
      // visual editor stores them in short_title and eyebrow respectively;
      // falling back to the badge would make a missing replacement text look
      // like a price override.
      promotionPriceText: promotionBenefit?.priceText,
      benefits: benefits.length ? benefits : undefined,
    };
    const current = servicesByCategory.get(service.category_id) ?? [];
    current.push(item);
    servicesByCategory.set(service.category_id, current);
  }

  const categories: CatalogCategory[] = categoryRows.map((category) => ({
    id: category.legacy_id,
    number: category.number,
    title: category.title,
    shortTitle: category.short_title,
    description: category.description,
    priceFrom: formatCategoryPriceFromServices(category, [
      ...(servicePriceRowsByCategory.get(category.id) ?? []),
      ...(servicePriceRowsByCategory.get(category.legacy_id) ?? []),
    ]),
    priceNote: category.price_note ?? undefined,
    masterIds: parseMasterIds(category.master_ids_json),
    // New categories receive a UUID primary key while the public model keeps
    // the editable legacy slug. Resolve by the real database id first so newly
    // created categories and services are immediately visible on the site.
    items: servicesByCategory.get(category.id) ?? servicesByCategory.get(category.legacy_id) ?? [],
  }));

  const workingHours: SiteWorkingHours[] = hoursRows.map((row) => ({
    id: row.id,
    weekday: row.weekday,
    specificDate: row.specific_date,
    isClosed: row.is_closed === 1,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    note: row.note,
    sortOrder: row.sort_order,
  }));
  const links = Object.fromEntries(linkRows.map((row): [string, SiteExternalLink] => [row.link_key, {
    id: row.id,
    key: row.link_key,
    kind: row.kind,
    label: row.label,
    url: row.url,
    phoneToCopy: row.phone_to_copy,
    openInNewTab: row.open_in_new_tab === 1,
    sortOrder: row.sort_order,
  }]));
  for (const key of ["phone", "max", "email", "vk", "dikidi_widget", "dikidi_script", "yandex_maps", "yandex_reviews", "yandex_reviews_widget", "yandex_map_widget_desktop", "yandex_map_widget_mobile"]) {
    if (!links[key]) throw new Error(`SQLite external link is missing: ${key}`);
  }
  const portfolio: PortfolioWork[] = portfolioRows.map((row) => ({
    id: row.id,
    categoryId: row.service_category_id,
    src: resolveMediaUrl(row.image_url, row.image_storage_key),
    alt: row.alt_text,
    label: row.title,
    description: row.description ?? "",
  })).filter((item) => item.src);
  const masters: SiteMaster[] = masterRows.map((row) => ({
    id: row.id,
    name: row.name,
    specialization: row.specialization,
    servicesText: row.services_text,
    imageUrl: resolveMediaUrl(row.image_url, row.image_storage_key),
    sortOrder: row.sort_order,
  }));
  const conditionsByOffer = new Map<string, SiteOfferCondition[]>();
  for (const row of conditionRows) {
    const conditions = conditionsByOffer.get(row.offer_id) ?? [];
    conditions.push({ id: row.id, conditionType: row.condition_type, operator: row.operator, amountValue: row.amount_value, textValue: row.text_value, title: row.title, description: row.description, sortOrder: row.sort_order });
    conditionsByOffer.set(row.offer_id, conditions);
  }
  const rulesByOffer = new Map<string, SiteOfferRule[]>();
  for (const row of ruleRows) {
    const rules = rulesByOffer.get(row.offer_id) ?? [];
    rules.push({ id: row.id, serviceId: row.service_id, ruleType: row.rule_type, discountAmount: row.discount_amount, discountPercent: row.discount_percent, freeVisitNumber: row.free_visit_number, usageLimit: row.usage_limit, sharedUsageGroup: row.shared_usage_group, sortOrder: row.sort_order });
    rulesByOffer.set(row.offer_id, rules);
  }
  const offers: SiteOffer[] = offerRows.map((row) => ({
    id: row.id,
    linkedServiceId: row.linked_service_id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    shortTitle: row.short_title,
    eyebrow: row.eyebrow,
    description: row.description,
    legalNote: row.legal_note,
    benefitType: row.benefit_type,
    benefitValue: row.benefit_value,
    nominalValue: row.nominal_value,
    freeVisitNumber: row.free_visit_number,
    frontUrl: resolveMediaUrl(row.front_url, row.front_storage_key) || (row.type === "certificate" ? "/images/certificate-front.webp" : row.type === "loyalty" ? "/images/loyalty-card-front.webp" : ""),
    backUrl: resolveMediaUrl(row.back_url, row.back_storage_key) || (row.type === "certificate" ? "/images/certificate-back.webp" : row.type === "loyalty" ? "/images/loyalty-card-back.webp" : ""),
    flipEnabled: row.flip_enabled === 1,
    transferable: row.is_transferable === 1,
    canCombine: row.can_combine_with_other_offers === 1,
    conditions: conditionsByOffer.get(row.id) ?? [],
    rules: rulesByOffer.get(row.id) ?? [],
    sortOrder: row.sort_order,
  }));

  const blocks = {
    award: {
      eyebrow: salonRow.award_eyebrow?.trim() || "Яндекс · 2026",
      title: salonRow.award_title?.trim() || "«Хорошее место» — благодаря вам",
      description: salonRow.award_description?.trim() || "Эту награду получают места, которые особенно ценят посетители. Спасибо, что выбираете «Ассоль» и делитесь впечатлениями.",
      videoUrl: resolveMediaUrl(salonRow.award_video_url, salonRow.award_video_storage_key) || "/media/good-place-2026.mp4",
    },
    atmosphere: {
      imageUrl: resolveMediaUrl(salonRow.atmosphere_image_url, salonRow.atmosphere_image_storage_key) || "/images/salon-interior-clean.webp",
    },
  };

  return {
    source: "sqlite",
    categories,
    salon: {
      name: salonRow.salon_name,
      phone: salonRow.phone,
      displayPhone: salonRow.display_phone,
      email: salonRow.email ?? "",
      region: salonRow.region ?? "",
      city: salonRow.city ?? "",
      streetAddress: salonRow.street_address,
      latitude: salonRow.latitude,
      longitude: salonRow.longitude,
      yandexOrganizationId: salonRow.yandex_organization_id ?? "",
      logoUrl: salonRow.logo_url ?? "/images/assol-logo.webp",
    },
    workingHours,
    masters,
    hoursLabel: formatHours(workingHours),
    links,
    portfolio,
    offers,
    blocks,
  };
}

async function loadSiteData(): Promise<SiteData> {
  // Read SQLite on every request so CMS changes are immediately visible on
  // both the public page and admin. Fallback is intentionally not used for a
  // failed query: an unavailable or corrupt database must fail loudly rather
  // than silently serving stale content.
  return loadFromDatabase(getSqliteDatabase());
}

// Read the SQLite file on every request so changes saved from /admin become
// visible on the public page without a process restart.
export async function getSiteData(): Promise<SiteData> {
  return loadSiteData();
}
