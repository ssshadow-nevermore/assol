const numberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatPriceNumber(value: number) {
  return numberFormatter.format(value).replace(/\u00a0/g, " ");
}

export type StoredPriceFields = {
  pricing_type?: unknown;
  price_amount?: unknown;
  price_min?: unknown;
  price_max?: unknown;
  price_tiers_json?: unknown;
  price_display_text?: unknown;
};

export type StoredCategoryPriceFields = {
  price_from_type?: unknown;
  price_from_amount?: unknown;
  price_from_min?: unknown;
  price_from_max?: unknown;
  price_from_display_text?: unknown;
};

/** Structured service fields used when deriving a category's starting price. */
export type CategoryServicePriceFields = StoredPriceFields;

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStoredTiers(value: unknown): Array<{ amount: number }> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((tier) => finiteNumber((tier as { amount?: unknown })?.amount))
      .filter((amount): amount is number => amount !== null && amount >= 0)
      .map((amount) => ({ amount }));
  } catch {
    return [];
  }
}

/**
 * Returns the smallest numeric base price represented by a service. Discount
 * data is deliberately not part of this model, so offer badges can never
 * change a category's headline price.
 */
export function getMinimumNumericPrice(fields: CategoryServicePriceFields): number | null {
  const type = typeof fields.pricing_type === "string" ? fields.pricing_type : "";
  const amount = finiteNumber(fields.price_amount);
  const min = finiteNumber(fields.price_min);
  const max = finiteNumber(fields.price_max);
  const tiers = parseStoredTiers(fields.price_tiers_json);

  if (type === "tiers" && tiers.length > 0) return Math.min(...tiers.map((tier) => tier.amount));
  if (type === "range" && min !== null && max !== null && min >= 0 && max >= min) return min;
  if ((type === "fixed" || type === "from") && amount !== null && amount >= 0) return amount;
  if (type === "free") return 0;

  // Be tolerant of imported rows without pricing_type, matching the public
  // formatter's legacy handling.
  if (amount !== null && amount >= 0) return amount;
  if (min !== null && max !== null && min >= 0 && max >= min) return min;
  if (tiers.length > 0) return Math.min(...tiers.map((tier) => tier.amount));
  return null;
}

/**
 * Derives the category label from active services. The category's legacy
 * price fields remain a fallback for old/imported categories, but a numeric
 * service price always wins and is reduced to the lowest valid base amount.
 */
export function formatCategoryPriceFromServices(
  category: StoredCategoryPriceFields,
  services: CategoryServicePriceFields[],
): string {
  const numericPrices = services
    .map((service) => getMinimumNumericPrice(service))
    // Free services remain visible in the catalog, but must not make a
    // category look free when it also contains paid services.
    .filter((price): price is number => price !== null && price > 0);
  if (numericPrices.length > 0) {
    const minimum = Math.min(...numericPrices);
    return `от ${formatPriceNumber(minimum)} ₽`;
  }
  return formatStoredCategoryPrice(category);
}

/**
 * Formats the canonical public price from the structured database fields.
 * `price_display_text` is used only for custom pricing or as a final legacy
 * value, so stale display text cannot override an edited amount/tier list.
 */
export function formatStoredPrice(fields: StoredPriceFields): string {
  const type = typeof fields.pricing_type === "string" ? fields.pricing_type : "";
  const amount = finiteNumber(fields.price_amount);
  const min = finiteNumber(fields.price_min);
  const max = finiteNumber(fields.price_max);
  const display = typeof fields.price_display_text === "string" ? fields.price_display_text.trim() : "";
  const tiers = parseStoredTiers(fields.price_tiers_json);

  if (type === "tiers" && tiers.length > 0) {
    return `${tiers.map((tier) => formatPriceNumber(tier.amount)).join(" / ")} ₽`;
  }
  if (type === "range" && min !== null && max !== null) {
    return `${formatPriceNumber(min)}–${formatPriceNumber(max)} ₽`;
  }
  if ((type === "fixed" || type === "from") && amount !== null && amount >= 0) {
    return `${type === "from" ? "от " : ""}${formatPriceNumber(amount)} ₽`;
  }
  if (type === "free") return "Бесплатно";
  if (type === "custom" && display) return display;

  // Be tolerant of older/imported rows whose pricing_type was not populated.
  if (amount !== null && amount >= 0) return `${formatPriceNumber(amount)} ₽`;
  if (min !== null && max !== null && min >= 0 && max >= min) return `${formatPriceNumber(min)}–${formatPriceNumber(max)} ₽`;
  if (tiers.length > 0) return `${tiers.map((tier) => formatPriceNumber(tier.amount)).join(" / ")} ₽`;
  return display || "Цена по запросу";
}

export function formatStoredCategoryPrice(fields: StoredCategoryPriceFields): string {
  const type = typeof fields.price_from_type === "string" ? fields.price_from_type : "";
  const amount = finiteNumber(fields.price_from_amount);
  const min = finiteNumber(fields.price_from_min);
  const max = finiteNumber(fields.price_from_max);
  const display = typeof fields.price_from_display_text === "string" ? fields.price_from_display_text.trim() : "";
  if (type === "range" && min !== null && max !== null) return `${formatPriceNumber(min)}–${formatPriceNumber(max)} ₽`;
  if ((type === "fixed" || type === "from") && amount !== null && amount >= 0) return `${type === "from" ? "от " : ""}${formatPriceNumber(amount)} ₽`;
  if (type === "free") return "Бесплатно";
  return display || "Цена по запросу";
}

export function applyDiscountToPriceLabel(price: string, discount: number) {
  if (discount <= 0 || !/\d/.test(price)) return price;

  const values = [...price.matchAll(/\d(?:[\d ]*\d)?/g)].map((match) => Number(match[0].replace(/\s/g, "")));
  if (values.length === 0) return price;

  const discountedValues = values.map((value) => Math.max(0, value - discount));
  if (discountedValues.every((value) => value === 0)) return "бесплатно";

  let index = 0;
  return price.replace(/\d(?:[\d ]*\d)?/g, () => formatPriceNumber(discountedValues[index++]));
}
