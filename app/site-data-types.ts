import type { CatalogCategory } from "./services-data";

export type SiteSalon = {
  name: string;
  phone: string;
  displayPhone: string;
  email: string;
  region: string;
  city: string;
  streetAddress: string;
  latitude: number | null;
  longitude: number | null;
  yandexOrganizationId: string;
  logoUrl: string;
};

export type SiteWorkingHours = {
  id: string;
  weekday: number | null;
  specificDate: string | null;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  note: string | null;
  sortOrder: number;
};

export type SiteMaster = {
  id: string;
  name: string;
  specialization: string;
  servicesText: string;
  imageUrl: string;
  sortOrder: number;
};

export type SiteExternalLink = {
  id: string;
  key: string;
  kind: string;
  label: string;
  url: string;
  phoneToCopy: string | null;
  openInNewTab: boolean;
  sortOrder: number;
};

export type PortfolioWork = {
  id: string;
  categoryId: string | null;
  categoryLabel?: string;
  src: string;
  alt: string;
  label: string;
  description: string;
};

export type SiteOfferCondition = {
  id: string;
  conditionType: string;
  operator: string;
  amountValue: number | null;
  textValue: string | null;
  title: string | null;
  description: string;
  sortOrder: number;
};

export type SiteOfferRule = {
  id: string;
  serviceId: string;
  ruleType: "fixed_discount" | "percent_discount" | "free" | "free_nth_visit";
  discountAmount: number | null;
  discountPercent: number | null;
  freeVisitNumber: number | null;
  usageLimit: number | null;
  sharedUsageGroup: string | null;
  sortOrder: number;
};

export type SiteOffer = {
  id: string;
  linkedServiceId: string | null;
  type: "promotion" | "loyalty" | "certificate" | "gift_card";
  slug: string;
  title: string;
  shortTitle: string | null;
  eyebrow: string | null;
  description: string;
  legalNote: string | null;
  benefitType: string;
  benefitValue: number | null;
  nominalValue: number | null;
  freeVisitNumber: number | null;
  frontUrl: string;
  backUrl: string;
  flipEnabled: boolean;
  transferable: boolean;
  canCombine: boolean;
  conditions: SiteOfferCondition[];
  rules: SiteOfferRule[];
  sortOrder: number;
};

export type SiteContentBlocks = {
  award: {
    eyebrow: string;
    title: string;
    description: string;
    videoUrl: string;
  };
  atmosphere: {
    imageUrl: string;
  };
};

export type SiteData = {
  source: "sqlite" | "fallback";
  categories: CatalogCategory[];
  salon: SiteSalon;
  workingHours: SiteWorkingHours[];
  masters: SiteMaster[];
  hoursLabel: string;
  links: Record<string, SiteExternalLink>;
  portfolio: PortfolioWork[];
  offers: SiteOffer[];
  blocks: SiteContentBlocks;
};
