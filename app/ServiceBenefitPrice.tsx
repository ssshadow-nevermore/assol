"use client";

import { useState } from "react";
import { applyDiscountToPriceLabel } from "./price-utils";
import type { CatalogBenefit } from "./services-data";

type ServiceBenefitPriceProps = {
  price: string;
  loyaltyEligible?: boolean;
  certificateDiscount?: number;
  promotionLabel?: string;
  promotionPriceText?: string;
  benefits?: CatalogBenefit[];
};

export default function ServiceBenefitPrice({ price, loyaltyEligible, certificateDiscount, promotionLabel, promotionPriceText, benefits }: ServiceBenefitPriceProps) {
  const legacyBenefits: CatalogBenefit[] = [
    ...(loyaltyEligible ? [{ id: "legacy-loyalty", offerId: "legacy-loyalty", type: "loyalty" as const, label: "6-я бесплатно", priceText: "6-я услуга — бесплатно", ruleType: "free_nth_visit" }] : []),
    ...(certificateDiscount ? [{ id: "legacy-certificate", offerId: "legacy-certificate", type: "certificate" as const, label: `Сертификат −${certificateDiscount} ₽`, priceText: "", discountAmount: certificateDiscount, ruleType: "fixed_discount" }] : []),
    ...(promotionLabel ? [{ id: "legacy-promotion", offerId: "legacy-promotion", type: "promotion" as const, label: promotionLabel, priceText: promotionPriceText || "Уточните условия акции" }] : []),
  ];
  const resolvedBenefits = benefits?.length ? benefits : legacyBenefits;
  const [activeBenefitId, setActiveBenefitId] = useState<string | null>(null);
  const [hoveredBenefitId, setHoveredBenefitId] = useState<string | null>(null);
  const [focusedBenefitId, setFocusedBenefitId] = useState<string | null>(null);
  const hasBenefit = resolvedBenefits.length > 0;

  if (!hasBenefit) return <strong>{price}</strong>;

  const visibleBenefitId = hoveredBenefitId || focusedBenefitId || activeBenefitId;
  const visibleBenefit = resolvedBenefits.find((benefit) => benefit.id === visibleBenefitId);
  const benefitLabel = visibleBenefit
    ? visibleBenefit.type === "certificate" && visibleBenefit.discountAmount
      ? applyDiscountToPriceLabel(price, visibleBenefit.discountAmount)
      : visibleBenefit.priceText || "Уточните условия акции"
    : "";

  return (
    <div className={`service-benefit-price${visibleBenefit ? " is-active" : ""}`}>
      <div className="benefit-badges">
        {resolvedBenefits.map((benefit) => {
          const isActive = activeBenefitId === benefit.id;
          const buttonLabel = benefit.type === "loyalty"
            ? "Показать условие акции: шестая услуга бесплатно"
            : benefit.type === "certificate"
              ? `Показать цену со скидкой ${benefit.discountAmount ?? 0} рублей по сертификату`
              : `Показать условие акции: ${benefit.label}`;
          return <button
            key={benefit.id}
            className={`benefit-badge benefit-badge--${benefit.type}${isActive ? " is-active" : ""}`}
            type="button"
            aria-pressed={isActive}
            aria-label={buttonLabel}
            onPointerEnter={() => setHoveredBenefitId(benefit.id)}
            onPointerLeave={() => setHoveredBenefitId(null)}
            onFocus={() => setFocusedBenefitId(benefit.id)}
            onBlur={() => setFocusedBenefitId(null)}
            onClick={() => setActiveBenefitId((current) => {
              const next = current === benefit.id ? null : benefit.id;
              // A second click/tap must restore the regular price even while
              // the pointer or keyboard focus remains on the same badge.
              if (next === null) {
                setHoveredBenefitId(null);
                setFocusedBenefitId(null);
              }
              return next;
            })}
          >{benefit.label}</button>;
        })}
      </div>
      <span className="benefit-price-stack" aria-live="polite">
        <strong className="benefit-price-original">{price}</strong>
        {visibleBenefit && <strong className="benefit-price-new">{benefitLabel}</strong>}
      </span>
    </div>
  );
}
