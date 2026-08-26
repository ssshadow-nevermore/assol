import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export type PriceTier = {
  label: string;
  amount: number;
  sortOrder: number;
};

const createdAt = () =>
  text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () =>
  text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const serviceCategories = sqliteTable(
  "service_categories",
  {
    id: text("id").primaryKey(),
    legacyId: text("legacy_id").notNull(),
    number: text("number").notNull(),
    title: text("title").notNull(),
    shortTitle: text("short_title").notNull(),
    description: text("description").notNull().default(""),
    priceFromType: text("price_from_type", {
      enum: ["fixed", "from", "range", "free", "custom"],
    })
      .notNull()
      .default("from"),
    priceFromAmount: integer("price_from_amount"),
    priceFromMin: integer("price_from_min"),
    priceFromMax: integer("price_from_max"),
    priceFromDisplayText: text("price_from_display_text"),
    priceNote: text("price_note"),
    masterIdsJson: text("master_ids_json", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("service_categories_legacy_id_unique").on(table.legacyId),
    index("service_categories_active_sort_idx").on(
      table.isActive,
      table.sortOrder,
    ),
    check(
      "service_categories_price_from_type_check",
      sql`${table.priceFromType} IN ('fixed', 'from', 'range', 'free', 'custom')`,
    ),
    check(
      "service_categories_master_ids_json_check",
      sql`json_valid(${table.masterIdsJson})`,
    ),
    check(
      "service_categories_is_active_check",
      sql`${table.isActive} IN (0, 1)`,
    ),
    check(
      "service_categories_price_range_check",
      sql`${table.priceFromMin} IS NULL OR ${table.priceFromMax} IS NULL OR ${table.priceFromMax} >= ${table.priceFromMin}`,
    ),
  ],
);

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => serviceCategories.id, {
        onUpdate: "cascade",
        onDelete: "restrict",
      }),
    legacyId: text("legacy_id").notNull(),
    name: text("name").notNull(),
    note: text("note"),
    pricingType: text("pricing_type", {
      enum: ["fixed", "from", "range", "tiers", "free", "custom"],
    }).notNull(),
    priceAmount: integer("price_amount"),
    priceMin: integer("price_min"),
    priceMax: integer("price_max"),
    priceTiersJson: text("price_tiers_json", { mode: "json" })
      .$type<PriceTier[]>()
      .notNull()
      .default(sql`'[]'`),
    priceDisplayText: text("price_display_text"),
    durationText: text("duration_text"),
    durationMinMinutes: integer("duration_min_minutes"),
    durationMaxMinutes: integer("duration_max_minutes"),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("services_category_legacy_id_unique").on(
      table.categoryId,
      table.legacyId,
    ),
    index("services_category_active_sort_idx").on(
      table.categoryId,
      table.isActive,
      table.sortOrder,
    ),
    check(
      "services_pricing_type_check",
      sql`${table.pricingType} IN ('fixed', 'from', 'range', 'tiers', 'free', 'custom')`,
    ),
    check(
      "services_price_tiers_json_check",
      sql`json_valid(${table.priceTiersJson})`,
    ),
    check("services_is_active_check", sql`${table.isActive} IN (0, 1)`),
    check(
      "services_price_values_check",
      sql`(
        (${table.pricingType} IN ('fixed', 'from') AND ${table.priceAmount} IS NOT NULL AND ${table.priceAmount} >= 0)
        OR (${table.pricingType} = 'range' AND ${table.priceMin} IS NOT NULL AND ${table.priceMax} IS NOT NULL AND ${table.priceMin} >= 0 AND ${table.priceMax} >= ${table.priceMin})
        OR (${table.pricingType} = 'tiers' AND json_array_length(${table.priceTiersJson}) > 0)
        OR (${table.pricingType} = 'free' AND COALESCE(${table.priceAmount}, 0) = 0)
        OR ${table.pricingType} = 'custom'
      )`,
    ),
    check(
      "services_duration_range_check",
      sql`${table.durationMinMinutes} IS NULL OR ${table.durationMaxMinutes} IS NULL OR ${table.durationMaxMinutes} >= ${table.durationMinMinutes}`,
    ),
  ],
);

export const salonSettings = sqliteTable(
  "salon_settings",
  {
    id: integer("id").primaryKey(),
    salonName: text("salon_name").notNull(),
    phone: text("phone").notNull(),
    displayPhone: text("display_phone").notNull(),
    email: text("email"),
    region: text("region"),
    city: text("city"),
    streetAddress: text("street_address").notNull(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    yandexOrganizationId: text("yandex_organization_id"),
    logoStorageKey: text("logo_storage_key"),
    logoUrl: text("logo_url"),
    awardEyebrow: text("award_eyebrow"),
    awardTitle: text("award_title"),
    awardDescription: text("award_description"),
    awardVideoStorageKey: text("award_video_storage_key"),
    awardVideoUrl: text("award_video_url"),
    atmosphereImageStorageKey: text("atmosphere_image_storage_key"),
    atmosphereImageUrl: text("atmosphere_image_url"),
    isActive: integer("is_active").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("salon_settings_singleton_check", sql`${table.id} = 1`),
    check("salon_settings_is_active_check", sql`${table.isActive} IN (0, 1)`),
  ],
);

export const masters = sqliteTable(
  "masters",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    specialization: text("specialization").notNull().default(""),
    servicesText: text("services_text").notNull().default(""),
    imageStorageKey: text("image_storage_key"),
    imageUrl: text("image_url"),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("masters_active_sort_idx").on(table.isActive, table.sortOrder),
    check("masters_is_active_check", sql`${table.isActive} IN (0, 1)`),
  ],
);

export const workingHours = sqliteTable(
  "working_hours",
  {
    id: text("id").primaryKey(),
    weekday: integer("weekday"),
    specificDate: text("specific_date"),
    isClosed: integer("is_closed").notNull().default(0),
    opensAt: text("opens_at"),
    closesAt: text("closes_at"),
    note: text("note"),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("working_hours_recurring_weekday_unique")
      .on(table.weekday)
      .where(sql`${table.specificDate} IS NULL`),
    uniqueIndex("working_hours_specific_date_unique")
      .on(table.specificDate)
      .where(sql`${table.specificDate} IS NOT NULL`),
    index("working_hours_weekday_date_active_idx").on(
      table.weekday,
      table.specificDate,
      table.isActive,
    ),
    check(
      "working_hours_schedule_kind_check",
      sql`(
        (${table.weekday} BETWEEN 1 AND 7 AND ${table.specificDate} IS NULL)
        OR (${table.weekday} IS NULL AND ${table.specificDate} IS NOT NULL)
      )`,
    ),
    check("working_hours_is_closed_check", sql`${table.isClosed} IN (0, 1)`),
    check("working_hours_is_active_check", sql`${table.isActive} IN (0, 1)`),
    check(
      "working_hours_time_required_check",
      sql`${table.isClosed} = 1 OR (${table.opensAt} IS NOT NULL AND ${table.closesAt} IS NOT NULL)`,
    ),
  ],
);

export const externalLinks = sqliteTable(
  "external_links",
  {
    id: text("id").primaryKey(),
    linkKey: text("link_key").notNull(),
    kind: text("kind", {
      enum: [
        "vk",
        "max",
        "email",
        "dikidi_widget",
        "dikidi_script",
        "yandex_maps",
        "yandex_reviews",
        "other",
      ],
    }).notNull(),
    label: text("label").notNull(),
    url: text("url").notNull(),
    phoneToCopy: text("phone_to_copy"),
    openInNewTab: integer("open_in_new_tab").notNull().default(1),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("external_links_link_key_unique").on(table.linkKey),
    index("external_links_active_sort_idx").on(table.isActive, table.sortOrder),
    check(
      "external_links_kind_check",
      sql`${table.kind} IN ('vk', 'max', 'email', 'dikidi_widget', 'dikidi_script', 'yandex_maps', 'yandex_reviews', 'other')`,
    ),
    check(
      "external_links_open_in_new_tab_check",
      sql`${table.openInNewTab} IN (0, 1)`,
    ),
    check("external_links_is_active_check", sql`${table.isActive} IN (0, 1)`),
  ],
);

export const portfolioItems = sqliteTable(
  "portfolio_items",
  {
    id: text("id").primaryKey(),
    serviceCategoryId: text("service_category_id").references(
      () => serviceCategories.id,
      { onUpdate: "cascade", onDelete: "set null" },
    ),
    title: text("title").notNull(),
    description: text("description"),
    altText: text("alt_text").notNull(),
    imageStorageKey: text("image_storage_key"),
    imageUrl: text("image_url"),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("portfolio_items_active_sort_idx").on(
      table.isActive,
      table.sortOrder,
    ),
    index("portfolio_items_category_idx").on(table.serviceCategoryId),
    check("portfolio_items_is_active_check", sql`${table.isActive} IN (0, 1)`),
    check(
      "portfolio_items_image_reference_check",
      sql`${table.imageStorageKey} IS NOT NULL OR ${table.imageUrl} IS NOT NULL`,
    ),
  ],
);

export const offers = sqliteTable(
  "offers",
  {
    id: text("id").primaryKey(),
    linkedServiceId: text("linked_service_id").references(() => services.id, {
      onUpdate: "cascade",
      onDelete: "restrict",
    }),
    type: text("type", {
      enum: ["promotion", "loyalty", "certificate", "gift_card"],
    }).notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    shortTitle: text("short_title"),
    eyebrow: text("eyebrow"),
    description: text("description").notNull(),
    legalNote: text("legal_note"),
    benefitType: text("benefit_type", {
      enum: [
        "fixed_discount",
        "percent_discount",
        "nominal",
        "free_nth_visit",
        "free_service",
        "custom",
      ],
    }).notNull(),
    benefitValue: integer("benefit_value"),
    nominalValue: integer("nominal_value"),
    currency: text("currency").notNull().default("RUB"),
    freeVisitNumber: integer("free_visit_number"),
    frontStorageKey: text("front_storage_key"),
    frontUrl: text("front_url"),
    backStorageKey: text("back_storage_key"),
    backUrl: text("back_url"),
    // Controls whether a configured back image is interactive. Keeping this
    // separate from the image reference lets admins turn flipping off without
    // deleting the previously uploaded back side.
    flipEnabled: integer("flip_enabled").notNull().default(1),
    validFrom: text("valid_from"),
    validUntil: text("valid_until"),
    isTransferable: integer("is_transferable").notNull().default(0),
    canCombineWithOtherOffers: integer("can_combine_with_other_offers")
      .notNull()
      .default(0),
    status: text("status", {
      enum: ["draft", "active", "hidden", "expired"],
    })
      .notNull()
      .default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("offers_slug_unique").on(table.slug),
    index("offers_status_sort_idx").on(table.status, table.sortOrder),
    index("offers_linked_service_idx").on(table.linkedServiceId),
    check(
      "offers_type_check",
      sql`${table.type} IN ('promotion', 'loyalty', 'certificate', 'gift_card')`,
    ),
    check(
      "offers_benefit_type_check",
      sql`${table.benefitType} IN ('fixed_discount', 'percent_discount', 'nominal', 'free_nth_visit', 'free_service', 'custom')`,
    ),
    check(
      "offers_nominal_value_check",
      sql`${table.benefitType} <> 'nominal' OR (${table.nominalValue} IS NOT NULL AND ${table.nominalValue} >= 0 AND ${table.benefitValue} IS NULL)`,
    ),
    check(
      "offers_free_nth_visit_check",
      sql`${table.benefitType} <> 'free_nth_visit' OR (${table.freeVisitNumber} IS NOT NULL AND ${table.freeVisitNumber} >= 2)`,
    ),
    check(
      "offers_validity_range_check",
      sql`${table.validFrom} IS NULL OR ${table.validUntil} IS NULL OR ${table.validUntil} >= ${table.validFrom}`,
    ),
    check("offers_is_transferable_check", sql`${table.isTransferable} IN (0, 1)`),
    check("offers_flip_enabled_check", sql`${table.flipEnabled} IN (0, 1)`),
    check(
      "offers_can_combine_check",
      sql`${table.canCombineWithOtherOffers} IN (0, 1)`,
    ),
    check(
      "offers_status_check",
      sql`${table.status} IN ('draft', 'active', 'hidden', 'expired')`,
    ),
  ],
);

export const offerConditions = sqliteTable(
  "offer_conditions",
  {
    id: text("id").primaryKey(),
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    conditionType: text("condition_type", {
      enum: [
        "minimum_single_service_price",
        "minimum_order_total",
        "service_purchase",
        "category_purchase",
        "new_customer",
        "nth_visit",
        "custom",
      ],
    }).notNull(),
    operator: text("operator", {
      enum: ["gt", "gte", "eq", "lte", "lt", "custom"],
    })
      .notNull()
      .default("custom"),
    amountValue: integer("amount_value"),
    textValue: text("text_value"),
    serviceId: text("service_id").references(() => services.id, {
      onUpdate: "cascade",
      onDelete: "restrict",
    }),
    serviceCategoryId: text("service_category_id").references(
      () => serviceCategories.id,
      { onUpdate: "cascade", onDelete: "restrict" },
    ),
    title: text("title"),
    description: text("description").notNull(),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("offer_conditions_offer_active_sort_idx").on(
      table.offerId,
      table.isActive,
      table.sortOrder,
    ),
    index("offer_conditions_service_idx").on(table.serviceId),
    index("offer_conditions_category_idx").on(table.serviceCategoryId),
    check(
      "offer_conditions_type_check",
      sql`${table.conditionType} IN ('minimum_single_service_price', 'minimum_order_total', 'service_purchase', 'category_purchase', 'new_customer', 'nth_visit', 'custom')`,
    ),
    check(
      "offer_conditions_operator_check",
      sql`${table.operator} IN ('gt', 'gte', 'eq', 'lte', 'lt', 'custom')`,
    ),
    check(
      "offer_conditions_value_check",
      sql`(
        (${table.conditionType} IN ('minimum_single_service_price', 'minimum_order_total') AND ${table.operator} IN ('gt', 'gte', 'eq', 'lte', 'lt') AND ${table.amountValue} IS NOT NULL AND ${table.amountValue} >= 0)
        OR (${table.conditionType} = 'service_purchase' AND ${table.serviceId} IS NOT NULL)
        OR (${table.conditionType} = 'category_purchase' AND ${table.serviceCategoryId} IS NOT NULL)
        OR (${table.conditionType} = 'nth_visit' AND ${table.amountValue} IS NOT NULL AND ${table.amountValue} >= 2)
        OR ${table.conditionType} IN ('new_customer', 'custom')
      )`,
    ),
    check("offer_conditions_is_active_check", sql`${table.isActive} IN (0, 1)`),
  ],
);

export const offerServiceRules = sqliteTable(
  "offer_service_rules",
  {
    id: text("id").primaryKey(),
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    ruleType: text("rule_type", {
      enum: ["fixed_discount", "percent_discount", "free", "free_nth_visit"],
    }).notNull(),
    discountAmount: integer("discount_amount"),
    discountPercent: integer("discount_percent"),
    freeVisitNumber: integer("free_visit_number"),
    usageLimit: integer("usage_limit"),
    sharedUsageGroup: text("shared_usage_group"),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("offer_service_rules_offer_service_unique").on(
      table.offerId,
      table.serviceId,
    ),
    index("offer_service_rules_offer_active_idx").on(
      table.offerId,
      table.isActive,
    ),
    index("offer_service_rules_service_active_idx").on(
      table.serviceId,
      table.isActive,
    ),
    check(
      "offer_service_rules_rule_type_check",
      sql`${table.ruleType} IN ('fixed_discount', 'percent_discount', 'free', 'free_nth_visit')`,
    ),
    check(
      "offer_service_rules_values_check",
      sql`(
        (${table.ruleType} = 'fixed_discount' AND ${table.discountAmount} IS NOT NULL AND ${table.discountAmount} > 0 AND ${table.discountPercent} IS NULL AND ${table.freeVisitNumber} IS NULL)
        OR (${table.ruleType} = 'percent_discount' AND ${table.discountPercent} BETWEEN 1 AND 100 AND ${table.discountAmount} IS NULL AND ${table.freeVisitNumber} IS NULL)
        OR (${table.ruleType} = 'free' AND ${table.discountAmount} IS NULL AND ${table.discountPercent} IS NULL AND ${table.freeVisitNumber} IS NULL)
        OR (${table.ruleType} = 'free_nth_visit' AND ${table.freeVisitNumber} IS NOT NULL AND ${table.freeVisitNumber} >= 2 AND ${table.discountAmount} IS NULL AND ${table.discountPercent} IS NULL)
      )`,
    ),
    check(
      "offer_service_rules_usage_limit_check",
      sql`${table.usageLimit} IS NULL OR ${table.usageLimit} > 0`,
    ),
    check(
      "offer_service_rules_is_active_check",
      sql`${table.isActive} IN (0, 1)`,
    ),
  ],
);

/** Server-side admin sessions; only the SHA-256 token hash is persisted. */
export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    accountId: text("account_id", { enum: ["owner", "developer"] }).notNull(),
    createdAt: createdAt(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    index("admin_sessions_expires_idx").on(table.expiresAt),
    index("admin_sessions_account_idx").on(table.accountId),
    check("admin_sessions_account_check", sql`${table.accountId} IN ('owner', 'developer')`),
  ],
);
