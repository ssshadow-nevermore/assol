import { catalogCategories } from "./services-data";
import { DIKIDI_SCRIPT_URL, DIKIDI_URL } from "./dikidi";
import type { SiteData, SiteExternalLink, SiteOffer, SiteOfferRule, SiteMaster } from "./site-data-types";

function link(
  id: string,
  key: string,
  kind: string,
  label: string,
  url: string,
  sortOrder: number,
  options: { phoneToCopy?: string; openInNewTab?: boolean } = {},
): SiteExternalLink {
  return {
    id,
    key,
    kind,
    label,
    url,
    phoneToCopy: options.phoneToCopy ?? null,
    openInNewTab: options.openInNewTab ?? true,
    sortOrder,
  };
}

const fallbackLinks = [
  link("external:phone", "phone", "other", "Позвонить", "tel:+79035150818", 0, { openInNewTab: false }),
  link("external:max", "max", "max", "MAX", "https://web.max.ru/", 1, { phoneToCopy: "+7 903 515-08-18" }),
  link("external:email", "email", "email", "Почта", "mailto:assol.beautysalon@yandex.ru", 2, { openInNewTab: false }),
  link("external:vk", "vk", "vk", "ВКонтакте", "https://vk.ru/assol_krasota", 3),
  link("external:dikidi-widget", "dikidi_widget", "dikidi_widget", "Записаться онлайн", DIKIDI_URL, 4, { openInNewTab: false }),
  link("external:dikidi-script", "dikidi_script", "dikidi_script", "Скрипт виджета DIKIDI", DIKIDI_SCRIPT_URL, 5, { openInNewTab: false }),
  link("external:yandex-route", "yandex_maps", "yandex_maps", "Построить маршрут", "https://yandex.ru/maps/org/1089857323", 6),
  link("external:yandex-reviews", "yandex_reviews", "yandex_reviews", "Отзывы на Яндекс Картах", "https://yandex.ru/maps/org/1089857323/reviews", 7),
  link("external:yandex-reviews-widget", "yandex_reviews_widget", "yandex_reviews", "Виджет отзывов Яндекс", "https://yandex.ru/maps-reviews-widget/1089857323?comments", 8, { openInNewTab: false }),
  link("external:yandex-map-widget-desktop", "yandex_map_widget_desktop", "yandex_maps", "Карта — компьютер", "https://yandex.ru/map-widget/v1/?ll=37.8478%2C56.0027&z=15&pt=37.8582615%2C56.002732%2Cpm2rdm", 9, { openInNewTab: false }),
  link("external:yandex-map-widget-mobile", "yandex_map_widget_mobile", "yandex_maps", "Карта — мобильные устройства", "https://yandex.ru/map-widget/v1/?ll=37.8582615%2C55.9970&z=15&pt=37.8582615%2C56.002732%2Cpm2rdm", 10, { openInNewTab: false }),
];

const loyaltyOfferId = "offer:loyalty-sixth-haircut";
const certificateOfferId = "offer:discount-certificate";
const loyaltyRules: SiteOfferRule[] = [];
const certificateRules: SiteOfferRule[] = [];

for (const category of catalogCategories) {
  for (const item of category.items) {
    const serviceId = `service:${category.id}:${item.id}`;
    if (item.loyaltyEligible) {
      loyaltyRules.push({
        id: `rule:loyalty:${category.id}:${item.id}`,
        serviceId,
        ruleType: "free_nth_visit",
        discountAmount: null,
        discountPercent: null,
        freeVisitNumber: 6,
        usageLimit: null,
        sharedUsageGroup: "haircut-loyalty-card",
        sortOrder: loyaltyRules.length,
      });
    }
    if (item.certificateDiscount) {
      certificateRules.push({
        id: `rule:certificate:${category.id}:${item.id}`,
        serviceId,
        ruleType: "fixed_discount",
        discountAmount: item.certificateDiscount,
        discountPercent: null,
        freeVisitNumber: null,
        usageLimit: 1,
        sharedUsageGroup: ["manicure", "pedicure"].includes(category.id) ? "nail-care-200" : null,
        sortOrder: certificateRules.length,
      });
    }
  }
}

const fallbackOffers: SiteOffer[] = [
  {
    id: loyaltyOfferId,
    linkedServiceId: null,
    type: "loyalty",
    slug: "sixth-haircut-free",
    title: "Каждая шестая стрижка — в подарок",
    shortTitle: "Шестая стрижка бесплатно",
    eyebrow: "Для новых клиентов",
    description: "После первого визита клиент получает физическую карточку. В акции участвуют мужская и женская модельные стрижки, стрижка кончиков и чёлки.",
    legalNote: "Учёт посещений ведёт салон на физической карточке.",
    benefitType: "free_nth_visit",
    benefitValue: null,
    nominalValue: null,
    freeVisitNumber: 6,
    frontUrl: "/images/loyalty-card-front.webp",
    backUrl: "/images/loyalty-card-back.webp",
    flipEnabled: true,
    transferable: false,
    canCombine: true,
    conditions: [],
    rules: loyaltyRules,
    sortOrder: 0,
  },
  {
    id: certificateOfferId,
    linkedServiceId: "service:certificate:discount-card",
    type: "certificate",
    slug: "discount-certificate",
    title: "Скидочный сертификат «Ассоль»",
    shortTitle: "Сертификат до 1 000 ₽ выгоды",
    eyebrow: "Получите бесплатно или купите за 1 000 ₽",
    description: "Сертификат выдаётся бесплатно при покупке одной услуги дороже 3 000 ₽. Его также можно приобрести отдельно, подарить или передать близкому человеку.",
    legalNote: "Каждая скидка используется один раз.",
    benefitType: "nominal",
    benefitValue: null,
    nominalValue: 1000,
    freeVisitNumber: null,
    frontUrl: "/images/certificate-front.webp",
    backUrl: "/images/certificate-back.webp",
    flipEnabled: true,
    transferable: true,
    canCombine: true,
    conditions: [],
    rules: certificateRules,
    sortOrder: 1,
  },
];

const fallbackMasters: SiteMaster[] = [
  { id: "dzhulia", name: "Джулия", specialization: "Парикмахер-универсал", servicesText: "Стрижки · окрашивание любой сложности · брови", imageUrl: "", sortOrder: 0 },
  { id: "marina", name: "Марина", specialization: "Мастер депиляции", servicesText: "Депиляция лица и тела", imageUrl: "", sortOrder: 1 },
  { id: "snezhana", name: "Снежана", specialization: "Парикмахер-универсал", servicesText: "Стрижки · окрашивание · химия", imageUrl: "", sortOrder: 2 },
  { id: "yulia", name: "Юлия", specialization: "Парикмахер-универсал, колорист", servicesText: "Стрижки · окрашивание любой сложности", imageUrl: "", sortOrder: 3 },
  { id: "elena", name: "Елена", specialization: "Мастер ногтевого сервиса", servicesText: "Маникюр · педикюр · покрытие", imageUrl: "", sortOrder: 4 },
];

export function getFallbackSiteData(): SiteData {
  return {
    source: "fallback",
    categories: catalogCategories,
    salon: {
      name: "Салон красоты Ассоль",
      phone: "+79035150818",
      displayPhone: "+7 903 515-08-18",
      email: "assol.beautysalon@yandex.ru",
      region: "Московская область",
      city: "Пушкино",
      streetAddress: "Московский проспект, 44",
      latitude: 56.002732,
      longitude: 37.8582615,
      yandexOrganizationId: "1089857323",
      logoUrl: "/images/assol-logo.webp",
    },
    workingHours: Array.from({ length: 7 }, (_, index) => ({
      id: `working-hours:${index + 1}`,
      weekday: index + 1,
      specificDate: null,
      isClosed: false,
      opensAt: "09:00",
      closesAt: "19:00",
      note: null,
      sortOrder: index,
    })),
    masters: fallbackMasters,
    hoursLabel: "Ежедневно · 09:00–19:00",
    links: Object.fromEntries(fallbackLinks.map((item) => [item.key, item])),
    portfolio: [
      { id: "portfolio:color-refresh", categoryId: "color", src: "/images/portfolio-color-refresh.webp", alt: "Окрашивание волос до и после в салоне Ассоль", label: "Окрашивание · Стрижка", description: "Обновление цвета и формы — результат крупным планом, без ретуши." },
      { id: "portfolio:women-hair", categoryId: "women", src: "/images/clean-women-hair.webp", alt: "Женская стрижка и укладка в салоне Ассоль", label: "Стрижка · Укладка", description: "Мягкие слои и укладка, которая подчёркивает движение волос." },
      { id: "portfolio:men-hair", categoryId: "men", src: "/images/clean-men.webp", alt: "Мужская стрижка в салоне Ассоль", label: "Мужская стрижка", description: "Чистая форма, плавный переход и аккуратная окантовка." },
    ],
    offers: fallbackOffers,
    blocks: {
      award: {
        eyebrow: "Яндекс · 2026",
        title: "«Хорошее место» — благодаря вам",
        description: "Эту награду получают места, которые особенно ценят посетители. Спасибо, что выбираете «Ассоль» и делитесь впечатлениями.",
        videoUrl: "/media/good-place-2026.mp4",
      },
      atmosphere: { imageUrl: "/images/salon-interior-clean.webp" },
    },
  };
}
