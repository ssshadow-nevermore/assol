export type CatalogBenefit = {
  id: string;
  offerId: string;
  type: "promotion" | "loyalty" | "certificate" | "gift_card";
  label: string;
  priceText: string;
  discountAmount?: number;
  ruleType?: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  price: string;
  duration?: string;
  note?: string;
  loyaltyEligible?: boolean;
  certificateDiscount?: number;
  promotionLabel?: string;
  promotionPriceText?: string;
  /** All active offer rules for this service. Legacy fields above are kept as projections. */
  benefits?: CatalogBenefit[];
};

export type Master = {
  id: string;
  name: string;
  role: string;
  initial: string;
};

export type CatalogCategory = {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  description: string;
  priceFrom: string;
  priceNote?: string;
  masterIds: string[];
  items: CatalogItem[];
};

export const masters: Master[] = [
  { id: "dzhulia", name: "Джулия", role: "Парикмахер-универсал", initial: "Д" },
  { id: "marina", name: "Марина", role: "Мастер депиляции", initial: "М" },
  { id: "snezhana", name: "Снежана", role: "Парикмахер-универсал", initial: "С" },
  { id: "yulia", name: "Юлия", role: "Парикмахер-универсал, колорист", initial: "Ю" },
  { id: "elena", name: "Елена", role: "Мастер ногтевого сервиса", initial: "Е" },
];

export const catalogCategories: CatalogCategory[] = [
  {
    id: "color",
    number: "01",
    title: "Окрашивание волос",
    shortTitle: "Окрашивание",
    description: "Тон в тон, сложные техники, осветление и бережная работа с цветом.",
    priceFrom: "от 400 ₽",
    priceNote: "Цены для коротких / средних / длинных волос. Краситель рассчитывается отдельно по фактическому расходу.",
    masterIds: ["dzhulia", "snezhana", "yulia"],
    items: [
      { id: "tone", name: "Окрашивание в один тон / тонирование", price: "2 000 / 2 500 / 3 000 ₽", duration: "от 1 часа", note: "Короткие / средние / длинные волосы", certificateDiscount: 200 },
      { id: "roots", name: "Окрашивание корней 1–2 см", price: "2 000 ₽", duration: "от 1 часа", certificateDiscount: 200 },
      { id: "own-color", name: "Корни со своей краской", price: "1 600 ₽", duration: "от 1 часа", certificateDiscount: 200 },
      { id: "emulsifying", name: "Эмульгирование, растяжка цвета по длине", price: "500 ₽", certificateDiscount: 200 },
      { id: "balayage", name: "Балаяж / шатуш / Airtouch / омбре", price: "5 000 / 7 000 / 12 000 ₽", duration: "4–5 часов", note: "Короткие / средние / длинные волосы, без расхода красителя", certificateDiscount: 200 },
      { id: "bronding", name: "Брондирование (эффект выгоревших волос)", price: "5 000 / 7 000 / 14 000 ₽", note: "Короткие / средние / длинные волосы", certificateDiscount: 200 },
      { id: "foil-highlights", name: "Мелирование на фольгу", price: "3 000 / 6 000 / 8 000 ₽", duration: "от 3 часов", note: "Короткие / средние / длинные волосы", certificateDiscount: 200 },
      { id: "cap-highlights", name: "Мелирование на шапочку", price: "2 000 / 3 000 ₽", certificateDiscount: 200 },
      { id: "color-removal", name: "Смывка", price: "4 000 / 6 000 ₽", duration: "от 3 часов", certificateDiscount: 200 },
      { id: "special-blonde", name: "Спецблонд", price: "5 000 / 7 000 / 9 000 ₽", duration: "от 2,5 часов", note: "Осветление, чистка длины, тонирование", certificateDiscount: 200 },
      { id: "colored-strand", name: "Цветная прядь", price: "400 / 600 / 800 ₽", duration: "от 3 часов", note: "Цена за одну прядь", certificateDiscount: 200 },
      { id: "contouring", name: "Контуринг", price: "от 4 000 ₽", duration: "от 1 ч 20 мин", certificateDiscount: 200 },
      { id: "diagnostics", name: "Диагностика волос", price: "бесплатно", duration: "до 15 минут" },
    ],
  },
  {
    id: "women",
    number: "02",
    title: "Женские стрижки и укладки",
    shortTitle: "Женские стрижки",
    description: "Форма, которая подходит типу волос и легко укладывается каждый день.",
    priceFrom: "от 400 ₽",
    priceNote: "Цены указаны для коротких / средних / длинных волос.",
    masterIds: ["dzhulia", "snezhana", "yulia"],
    items: [
      { id: "model", name: "Модельная стрижка", price: "900 / 1 300 / 1 700 ₽", duration: "40–60 минут", loyaltyEligible: true },
      { id: "creative", name: "Креативная стрижка", price: "1 300 / 1 600 / 1 800 ₽", duration: "40–60 минут" },
      { id: "bob-square", name: "Каре", price: "1 400 / 1 600 / 1 900 ₽", duration: "от 40 минут" },
      { id: "bob", name: "Боб", price: "1 500 / 1 700 / 2 000 ₽" },
      { id: "cascade", name: "Каскад", price: "1 700 / 1 900 / 2 100 ₽", duration: "от 40 минут" },
      { id: "bangs", name: "Стрижка чёлки", price: "400 / 600 ₽", duration: "от 15 минут", loyaltyEligible: true },
      { id: "curtain-bangs", name: "Чёлка-шторка с укладкой", price: "500 ₽", duration: "15 минут" },
      { id: "ends", name: "Стрижка кончиков", price: "700 ₽", duration: "20 минут", loyaltyEligible: true },
      { id: "wash-dry", name: "Мытьё головы и сушка", price: "400 / 600 ₽", duration: "от 10 минут", note: "Шампунь и бальзам" },
      { id: "hair-care", name: "Уход за волосами", price: "700 ₽", duration: "от 15 минут", note: "Включает мытьё и уход" },
      { id: "brushing", name: "Укладка на брашинг", price: "1 200 / 1 500 / 1 800 ₽", duration: "40–60 минут", certificateDiscount: 150 },
      { id: "iron", name: "Укладка плойкой или утюжком", price: "1 200 / 1 500 / 1 800 ₽", duration: "40–60 минут", certificateDiscount: 150 },
    ],
  },
  {
    id: "men",
    number: "03",
    title: "Мужские стрижки и борода",
    shortTitle: "Мужские стрижки",
    description: "Классические и современные формы, окантовка и оформление бороды.",
    priceFrom: "от 200 ₽",
    masterIds: ["dzhulia", "snezhana", "yulia"],
    items: [
      { id: "model", name: "Модельная стрижка", price: "900 ₽", duration: "30 минут", loyaltyEligible: true },
      { id: "creative", name: "Креативная стрижка", price: "1100 ₽", duration: "40 минут" },
      { id: "scissors", name: "Стрижка полностью ножницами", price: "1100 ₽", duration: "30 минут" },
      { id: "one-guard", name: "Стрижка под одну насадку", price: "600 ₽", duration: "10 минут" },
      { id: "multiple-guards", name: "Стрижка под несколько насадок", price: "900 ₽", duration: "20 минут" },
      { id: "zero", name: "Стрижка наголо", price: "500 ₽", duration: "10 минут" },
      { id: "outline", name: "Окантовка машинкой", price: "300 ₽" },
      { id: "beard-guard", name: "Стрижка бороды под насадку", price: "400 ₽", duration: "10 минут" },
      { id: "beard-scissors", name: "Стрижка бороды ножницами", price: "600 ₽" },
      { id: "haircut-beard", name: "Стрижка и борода под насадку", price: "1 000 ₽", duration: "1 час" },
      { id: "haircut-beard-scissors", name: "Стрижка и борода ножницами", price: "1 400 ₽", duration: "1 час" },
      { id: "wash", name: "Мытьё головы и сушка", price: "200 ₽", duration: "10 минут" },
      { id: "wax", name: "Эпиляция воском одной зоны", price: "300 ₽", note: "Уши или нос" },
    ],
  },
  {
    id: "children",
    number: "04",
    title: "Детские стрижки",
    shortTitle: "Детские стрижки",
    description: "Спокойный и аккуратный подход к маленьким гостям салона.",
    priceFrom: "от 200 ₽",
    masterIds: ["dzhulia", "snezhana", "yulia"],
    items: [
      { id: "model", name: "Модельная детская стрижка", price: "900 ₽", duration: "30 минут" },
      { id: "creative", name: "Креативная детская стрижка", price: "1100 ₽", duration: "40 минут" },
      { id: "wash", name: "Мытьё головы", price: "200 ₽", duration: "10 минут" },
    ],
  },
  {
    id: "texture",
    number: "05",
    title: "Биозавивка и прикорневой объём",
    shortTitle: "Завивка и объём",
    description: "Мягкая долговременная текстура и объём с учётом длины волос.",
    priceFrom: "от 3 500 ₽",
    priceNote: "Цены для коротких / средних / длинных волос.",
    masterIds: ["snezhana"],
    items: [
      { id: "bio-wave", name: "Биозавивка", price: "3 500 / 4 400 / 6 000 ₽", duration: "от 2 часов", certificateDiscount: 200 },
      { id: "root-volume", name: "Прикорневой объём", price: "от 4 000 ₽", duration: "от 2 часов" },
    ],
  },
  {
    id: "manicure",
    number: "06",
    title: "Маникюр",
    shortTitle: "Маникюр",
    description: "Маникюр, покрытие, укрепление, наращивание и дизайн ногтей.",
    priceFrom: "от 200 ₽",
    masterIds: ["elena"],
    items: [
      { id: "complex", name: "Маникюр-комплекс", price: "2 200 ₽", note: "Снятие, маникюр, однотонное покрытие", certificateDiscount: 200 },
      { id: "complex-strength", name: "Маникюр-комплекс с укреплением", price: "2 500 ₽", certificateDiscount: 200 },
      { id: "no-coating", name: "Маникюр без покрытия", price: "1 000 ₽", certificateDiscount: 200 },
      { id: "with-coating", name: "Маникюр с покрытием", price: "1 900 ₽", certificateDiscount: 200 },
      { id: "men", name: "Мужской маникюр", price: "1 500 ₽", certificateDiscount: 200 },
      { id: "extensions", name: "Наращивание ногтей, первое посещение моделью", price: "2 500 ₽" },
      { id: "polish-removal", name: "Снятие лака", price: "200 ₽" },
      { id: "gel-removal", name: "Снятие гель-лака", price: "300 ₽" },
      { id: "extension-removal", name: "Снятие наращённых ногтей", price: "600 ₽" },
      { id: "trim", name: "Стрижка ногтей", price: "300 ₽" },
      { id: "design", name: "Френч / стемпинг / художественный дизайн / стразы", price: "300 ₽" },
      { id: "repair", name: "Ремонт одного ногтя", price: "250 ₽" }
    ],
  },
  {
    id: "pedicure",
    number: "07",
    title: "Педикюр",
    shortTitle: "Педикюр",
    description: "Гигиенический и комплексный уход за стопами и ногтями.",
    priceFrom: "от 200 ₽",
    masterIds: ["elena"],
    items: [
      { id: "complex", name: "Педикюр-комплекс", price: "2 900 ₽", note: "Снятие, педикюр, однотонное покрытие", certificateDiscount: 200 },
      { id: "toes-gel", name: "Обработка пальчиков с покрытием гель-лаком", price: "2 300 ₽" },
      { id: "men", name: "Мужской гигиенический педикюр", price: "2 500 ₽", certificateDiscount: 200 },
      { id: "hygiene", name: "Гигиенический педикюр", price: "2 000 ₽", note: "Кутикула, форма ногтей, бесцветный укрепляющий лак", certificateDiscount: 200 },
      { id: "feet", name: "Обработка стопы", price: "1 600 ₽" },
      { id: "complex-foot", name: "Вросший ноготь / тампонада / натоптыши / трещины", price: "500 ₽" },
      { id: "polish-removal", name: "Снятие лака", price: "200 ₽" },
      { id: "gel-removal", name: "Снятие гель-лака", price: "300 ₽" },
      { id: "paraffin", name: "Парафинотерапия", price: "800 ₽", note: "Горячая или холодная, скраб и маска" },
    ],
  },
  {
    id: "depilation",
    number: "08",
    title: "Депиляция",
    shortTitle: "Депиляция",
    description: "Деликатная депиляция лица и тела с профессиональным уходом.",
    priceFrom: "от 400 ₽",
    masterIds: ["marina", "yulia"],
    items: [
      { id: "deep-bikini", name: "Глубокое бикини", price: "1 800 ₽", duration: "30 минут", certificateDiscount: 100 },
      { id: "classic-bikini", name: "Классическое бикини", price: "1 400 ₽", duration: "30 минут", certificateDiscount: 100 },
      { id: "full-legs", name: "Ноги полностью", price: "1 900 ₽", duration: "1 час", certificateDiscount: 100 },
      { id: "lower-legs", name: "Ноги до колена", price: "1 000 ₽", duration: "30 минут", certificateDiscount: 100 },
      { id: "full-arms", name: "Руки полностью", price: "1 200 ₽", duration: "50 минут", certificateDiscount: 100 },
      { id: "half-arms", name: "Руки до локтя", price: "600 ₽", duration: "25 минут", certificateDiscount: 100 },
      { id: "buttocks", name: "Ягодицы", price: "600 ₽", duration: "20 минут", certificateDiscount: 100 },
      { id: "stomach", name: "Живот полностью", price: "600 ₽", duration: "20 минут", certificateDiscount: 100 },
      { id: "armpits", name: "Подмышечные впадины", price: "600 ₽", duration: "15 минут", certificateDiscount: 100 },
      { id: "full-face", name: "Лицо полностью", price: "1 000 ₽", duration: "30 минут", certificateDiscount: 100 },
      { id: "forehead", name: "Лоб", price: "500 ₽", duration: "15 минут", certificateDiscount: 100 },
      { id: "chin", name: "Подбородок", price: "400 ₽", duration: "5 минут", certificateDiscount: 100 },
      { id: "upper-lip", name: "Усики", price: "400 ₽", duration: "10 минут", certificateDiscount: 100 },
      { id: "lip-chin", name: "Усики и подбородок", price: "700 ₽", duration: "25 минут", certificateDiscount: 100 },
      { id: "neck", name: "Шея, окантовка", price: "400 ₽", duration: "10 минут", certificateDiscount: 100 },
    ],
  },
  {
    id: "brows",
    number: "09",
    title: "Брови и ресницы",
    shortTitle: "Брови и ресницы",
    description: "Архитектура, коррекция, окрашивание и ламинирование.",
    priceFrom: "от 300 ₽",
    masterIds: ["dzhulia"],
    items: [
      { id: "architecture", name: "Архитектура бровей", price: "1 200 ₽", duration: "1 час", note: "Построение формы, коррекция и окрашивание", certificateDiscount: 150 },
      { id: "correction", name: "Коррекция бровей пинцетом", price: "600 ₽", duration: "30 минут" },
      { id: "one-zone", name: "Эпиляция одной зоны", price: "300 ₽" },
      { id: "paint", name: "Окрашивание бровей краской", price: "600 ₽", duration: "30 минут" },
    ],
  },
  {
    id: "certificate",
    number: "10",
    title: "Скидочный сертификат",
    shortTitle: "Сертификат",
    description: "До 1 000 ₽ выгоды на шесть направлений — для себя или в подарок.",
    priceFrom: "1 000 ₽",
    priceNote: "Сертификат выдаётся бесплатно при покупке одной услуги дороже 3 000 ₽ или приобретается отдельно. Каждая скидка используется один раз; маникюр и педикюр делят одну общую скидку 200 ₽.",
    masterIds: [],
    items: [
      { id: "discount-card", name: "Скидочный сертификат «Ассоль»", price: "1 000 ₽", note: "Можно подарить или передать другому человеку. Акция на шестую стрижку сохраняется." },
    ],
  },
];

export function getMasters(masterIds: string[]) {
  return masterIds.map((id) => masters.find((master) => master.id === id)).filter((master): master is Master => Boolean(master));
}
