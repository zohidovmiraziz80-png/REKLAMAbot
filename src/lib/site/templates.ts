import { DEFAULT_BLOCK_STYLE, siteSchema, type Block, type Site } from "./schema";

/**
 * Tayyor shablonlar — AI'siz sayt yaratish uchun.
 * Foydalanuvchi biznes nomi va aloqa ma'lumotlarini kiritadi, qolganini tahrirlovchida o'zgartiradi.
 * Narx, telefon va boshqa ma'lumotlar o'ylab topilmaydi — bo'sh qoldiriladi.
 */

export type TemplateDetails = {
  businessName: string;
  phone?: string;
  telegram?: string;
  instagram?: string;
  address?: string;
};

export const TEMPLATE_IDS_LIST = [
  "market",
  "bazaar",
  "electro",
  "fashion",
  "beauty",
  "kids",
  "gifts",
  "home",
  "flowers",
  "food",
  "sport",
  "auto",
  "stationery",
  "minimal",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS_LIST)[number];

type Look = {
  hero: "promo" | "split" | "classic" | "image" | "minimal";
  card: "market" | "border" | "shadow" | "flat";
  ratio: "square" | "portrait" | "landscape";
  columns: "4" | "5";
  footer: "columns" | "dark" | "simple";
  /** Har bir kategoriya alohida qator bo'lib chiqsinmi */
  rows: boolean;
};

type TemplateDef = {
  id: TemplateId;
  title: string;
  description: string;
  emoji: string;
  theme: Site["theme"];
  look: Look;
  hero: { heading: (name: string) => string; sub: string; cta: string };
  perks: [string, string, string][];
};

let counter = 0;
const bid = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

function contact(d: TemplateDetails, heading = "Biz bilan bog'laning", text = "Savollaringiz bo'lsa, yozing yoki qo'ng'iroq qiling."): Block {
  return {
    type: "contact",
    id: bid(),
    heading,
    text,
    phone: d.phone ?? "",
    telegram: d.telegram ?? "",
    instagram: d.instagram ?? "",
    address: d.address ?? "",
    workingHours: "",
  };
}

const TEMPLATES: TemplateDef[] = [
  {
    id: "market",
    title: "Marketpleys",
    description: "Katta qidiruv, katalog menyusi, kategoriya qatorlari",
    emoji: "🛒",
    theme: { primary: "#0f2d6b", accent: "#f7821b", font: "modern", radius: "soft", mode: "light" },
    look: { hero: "promo", card: "market", ratio: "portrait", columns: "5", footer: "columns", rows: true },
    hero: { heading: (n) => `${n} — hammasi bir joyda`, sub: "Minglab mahsulotlar, qulay narxlar va tez yetkazib berish.", cta: "Xarid qilish" },
    perks: [
      ["🚚", "Tez yetkazish", "Buyurtma tez yetib boradi"],
      ["🛡️", "Sifat kafolati", "Har bir mahsulot tekshiriladi"],
      ["💳", "Qulay to'lov", "Naqd, karta, Click yoki Payme"],
    ],
  },
  {
    id: "bazaar",
    title: "Oziq-ovqat marketi",
    description: "Mahsulotlar, ichimliklar, kundalik ehtiyojlar",
    emoji: "🥦",
    theme: { primary: "#0b6b3a", accent: "#ffb703", font: "rounded", radius: "soft", mode: "light" },
    look: { hero: "promo", card: "market", ratio: "square", columns: "5", footer: "columns", rows: true },
    hero: { heading: (n) => `${n} — yangi va arzon`, sub: "Kundalik mahsulotlar uyingizgacha yetkaziladi.", cta: "Savatni to'ldirish" },
    perks: [
      ["🥬", "Har kuni yangi", "Mahsulotlar har kuni yangilanadi"],
      ["⏱️", "Tez yetkazish", "Bugun buyurtma — bugun uyda"],
      ["💰", "Arzon narxlar", "Bozor narxidan qimmat emas"],
    ],
  },
  {
    id: "electro",
    title: "Texnika do'koni",
    description: "Telefon, gadjet, maishiy texnika — qorong'i dizayn",
    emoji: "📱",
    theme: { primary: "#1e40af", accent: "#06b6d4", font: "modern", radius: "soft", mode: "dark" },
    look: { hero: "promo", card: "market", ratio: "square", columns: "5", footer: "dark", rows: true },
    hero: { heading: (n) => `${n} — zamonaviy texnika`, sub: "Original mahsulotlar, kafolat va tez yetkazib berish.", cta: "Katalogni ochish" },
    perks: [
      ["✅", "Original", "Faqat rasmiy mahsulotlar"],
      ["🛡️", "Kafolat", "Har bir mahsulotga kafolat"],
      ["💳", "Muddatli to'lov", "Qulay to'lov usullari"],
    ],
  },
  {
    id: "fashion",
    title: "Moda butik",
    description: "Kiyim, poyabzal, aksessuarlar — nafis uslub",
    emoji: "👗",
    theme: { primary: "#111111", accent: "#c08457", font: "classic", radius: "sharp", mode: "light" },
    look: { hero: "split", card: "market", ratio: "portrait", columns: "4", footer: "dark", rows: true },
    hero: { heading: (n) => `${n} — yangi kolleksiya`, sub: "Mavsumning eng so'nggi uslublari. O'lchamingizni tanlang va buyurtma bering.", cta: "Kolleksiyani ko'rish" },
    perks: [
      ["✨", "Yangi kolleksiya", "Har hafta yangi modellar"],
      ["🔁", "Almashtirish", "O'lcham to'g'ri kelmasa almashtiramiz"],
      ["🚚", "Yetkazish", "Shahar bo'ylab tez yetkazamiz"],
    ],
  },
  {
    id: "beauty",
    title: "Kosmetika",
    description: "Parvarish, pardoz, atirlar",
    emoji: "💄",
    theme: { primary: "#b03a5b", accent: "#f4a259", font: "rounded", radius: "round", mode: "light" },
    look: { hero: "promo", card: "market", ratio: "portrait", columns: "5", footer: "columns", rows: true },
    hero: { heading: (n) => `${n} — go'zallik shu yerda`, sub: "Original kosmetika va parvarish vositalari.", cta: "Tanlash" },
    perks: [
      ["🌿", "Original", "Sertifikatlangan mahsulotlar"],
      ["🎁", "Sovg'a qadoq", "Chiroyli qadoqlab beramiz"],
      ["🚚", "Yetkazish", "Tez va ehtiyotkor yetkazish"],
    ],
  },
  {
    id: "kids",
    title: "Bolalar dunyosi",
    description: "O'yinchoqlar, bolalar kiyimi va buyumlari",
    emoji: "🧸",
    theme: { primary: "#1d4ed8", accent: "#facc15", font: "rounded", radius: "round", mode: "light" },
    look: { hero: "promo", card: "market", ratio: "square", columns: "5", footer: "columns", rows: true },
    hero: { heading: (n) => `${n} — bolalar uchun eng yaxshisi`, sub: "O'yinchoqlar, kiyimlar va kerakli buyumlar bir joyda.", cta: "Xarid qilish" },
    perks: [
      ["🧸", "Xavfsiz", "Bolalar uchun xavfsiz materiallar"],
      ["🎁", "Sovg'aga tayyor", "Qadoqlab beramiz"],
      ["🚚", "Yetkazish", "Uyingizgacha yetkazamiz"],
    ],
  },
  {
    id: "gifts",
    title: "Sovg'alar do'koni",
    description: "Sovg'alar, suvenirlar, bayram to'plamlari",
    emoji: "🎁",
    theme: { primary: "#9b1c1c", accent: "#f59e0b", font: "rounded", radius: "soft", mode: "light" },
    look: { hero: "promo", card: "market", ratio: "portrait", columns: "5", footer: "columns", rows: true },
    hero: { heading: (n) => `${n} — yaqinlaringizni xursand qiling`, sub: "Har qanday bayram uchun original sovg'alar.", cta: "Sovg'a tanlash" },
    perks: [
      ["🎀", "Chiroyli qadoq", "Har bir sovg'a qadoqlanadi"],
      ["💌", "Tabriknoma", "Istak matnini qo'shamiz"],
      ["🚚", "Yetkazish", "Aytilgan vaqtda yetkazamiz"],
    ],
  },
  {
    id: "home",
    title: "Uy-ro'zg'or",
    description: "Idish-tovoq, uy jihozlari, tozalik vositalari",
    emoji: "🏠",
    theme: { primary: "#0f766e", accent: "#f97316", font: "modern", radius: "soft", mode: "light" },
    look: { hero: "promo", card: "market", ratio: "square", columns: "5", footer: "columns", rows: true },
    hero: { heading: (n) => `${n} — uyingiz uchun hammasi`, sub: "Sifatli uy-ro'zg'or buyumlari qulay narxlarda.", cta: "Xarid qilish" },
    perks: [
      ["🚚", "Tez yetkazish", "Buyurtma tez yetib boradi"],
      ["🛡️", "Sifat kafolati", "Har bir mahsulot tekshiriladi"],
      ["💳", "Qulay to'lov", "Naqd, karta, Click yoki Payme"],
    ],
  },
  {
    id: "flowers",
    title: "Gul do'koni",
    description: "Buketlar, gul savatlari va sovg'alar",
    emoji: "💐",
    theme: { primary: "#7a1f4b", accent: "#e8457b", font: "rounded", radius: "round", mode: "light" },
    look: { hero: "classic", card: "shadow", ratio: "square", columns: "4", footer: "columns", rows: false },
    hero: { heading: (n) => `${n} — yangi uzilgan gullar`, sub: "Har qanday bayram uchun chiroyli buketlar. Shahar bo'ylab yetkazib beramiz.", cta: "Buket tanlash" },
    perks: [
      ["🌸", "Har doim yangi", "Gullar har kuni yangilanadi"],
      ["🚗", "Yetkazish", "Shahar bo'ylab tez yetkazamiz"],
      ["💌", "Tabriknoma", "Buketga istak matnini qo'shamiz"],
    ],
  },
  {
    id: "food",
    title: "Taom yetkazish",
    description: "Kafe, restoran, fast-food — menyu bo'limlari bilan",
    emoji: "🍔",
    theme: { primary: "#3b1f0f", accent: "#e8590c", font: "rounded", radius: "soft", mode: "light" },
    look: { hero: "image", card: "border", ratio: "landscape", columns: "4", footer: "dark", rows: true },
    hero: { heading: (n) => `${n} — mazali taomlar`, sub: "Issiq va yangi taomlar. Kafeda yoki yetkazib berish bilan.", cta: "Menyuni ko'rish" },
    perks: [
      ["🔥", "Issiq holda", "Taom issiq holda yetkaziladi"],
      ["⏱️", "30–60 daqiqa", "Tez tayyorlaymiz va yetkazamiz"],
      ["⭐", "Yangi mahsulotlar", "Har kuni yangi masalliqlar"],
    ],
  },
  {
    id: "sport",
    title: "Sport do'koni",
    description: "Sport kiyimlari, jihozlar, oziqlar",
    emoji: "⚽",
    theme: { primary: "#0f172a", accent: "#22c55e", font: "modern", radius: "soft", mode: "light" },
    look: { hero: "promo", card: "market", ratio: "square", columns: "5", footer: "dark", rows: true },
    hero: { heading: (n) => `${n} — harakatda bo'ling`, sub: "Sport kiyimlari va jihozlari — mashg'ulot uchun hammasi.", cta: "Xarid qilish" },
    perks: [
      ["🚚", "Tez yetkazish", "Buyurtma tez yetib boradi"],
      ["🛡️", "Sifat kafolati", "Har bir mahsulot tekshiriladi"],
      ["💳", "Qulay to'lov", "Naqd, karta, Click yoki Payme"],
    ],
  },
  {
    id: "auto",
    title: "Avto ehtiyot qismlar",
    description: "Ehtiyot qismlar, moylar, aksessuarlar",
    emoji: "🚗",
    theme: { primary: "#1f2937", accent: "#eab308", font: "modern", radius: "sharp", mode: "light" },
    look: { hero: "classic", card: "border", ratio: "square", columns: "5", footer: "dark", rows: true },
    hero: { heading: (n) => `${n} — avtomobilingiz uchun`, sub: "Ehtiyot qismlar, moylar va aksessuarlar. Kerakli qismni tez topamiz.", cta: "Qism qidirish" },
    perks: [
      ["🔧", "Original qismlar", "Ishonchli ishlab chiqaruvchilar"],
      ["📦", "Katta tanlov", "Ko'plab rusumlar uchun"],
      ["🚚", "Yetkazish", "Viloyatlarga ham jo'natamiz"],
    ],
  },
  {
    id: "stationery",
    title: "Kanselyariya va kitoblar",
    description: "Daftar, ruchka, kitoblar, ofis buyumlari",
    emoji: "📚",
    theme: { primary: "#1e3a5f", accent: "#ef4444", font: "modern", radius: "soft", mode: "light" },
    look: { hero: "promo", card: "market", ratio: "portrait", columns: "5", footer: "columns", rows: true },
    hero: { heading: (n) => `${n} — o'qish va ish uchun`, sub: "Kanselyariya, kitoblar va ofis buyumlari bir joyda.", cta: "Xarid qilish" },
    perks: [
      ["🚚", "Tez yetkazish", "Buyurtma tez yetib boradi"],
      ["🛡️", "Sifat kafolati", "Har bir mahsulot tekshiriladi"],
      ["💳", "Qulay to'lov", "Naqd, karta, Click yoki Payme"],
    ],
  },
  {
    id: "minimal",
    title: "Minimal do'kon",
    description: "Oq fon, ortiqcha bezaksiz — mahsulot birinchi o'rinda",
    emoji: "◻️",
    theme: { primary: "#111827", accent: "#2563eb", font: "modern", radius: "sharp", mode: "light" },
    look: { hero: "minimal", card: "flat", ratio: "square", columns: "4", footer: "simple", rows: false },
    hero: { heading: (n) => `${n}`, sub: "Sifatli mahsulotlar. Oddiy va tez buyurtma.", cta: "Mahsulotlar" },
    perks: [
      ["🚚", "Tez yetkazish", "Buyurtma tez yetib boradi"],
      ["🛡️", "Sifat kafolati", "Har bir mahsulot tekshiriladi"],
      ["💳", "Qulay to'lov", "Naqd, karta, Click yoki Payme"],
    ],
  },
];

/** Shablon bloklari: banner → afzalliklar → yangiliklar → kategoriya qatorlari → barcha mahsulotlar → aloqa */
function buildBlocks(t: TemplateDef, d: TemplateDetails, categories: string[]): Block[] {
  const { look } = t;
  const market = look.card === "market";
  const blocks: Block[] = [
    {
      type: "hero",
      variant: look.hero,
      id: bid(),
      heading: t.hero.heading(d.businessName),
      subheading: t.hero.sub,
      ctaText: t.hero.cta,
      ctaLink: "#katalog",
      align: look.hero === "minimal" ? "left" : "center",
    },
    {
      type: "features",
      variant: "strip",
      id: bid(),
      heading: "",
      items: t.perks.map(([icon, title, text]) => ({ icon, title, text })),
    },
    {
      type: "shop",
      variant: "row",
      id: bid(),
      heading: "Yangiliklar",
      subheading: "",
      source: "new",
      limit: 12,
      card: look.card,
      ratio: look.ratio,
      showSearch: false,
    },
  ];
  if (look.rows) {
    for (const c of categories.slice(0, 8)) {
      blocks.push({ type: "shop", variant: "row", id: bid(), heading: c, subheading: "", category: c, limit: 12, card: look.card, ratio: look.ratio, showSearch: false });
    }
  }
  blocks.push({
    type: "shop",
    variant: "grid",
    id: bid(),
    heading: market ? "Barcha mahsulotlar" : "Mahsulotlar",
    subheading: "",
    card: look.card,
    columns: look.columns,
    mobileColumns: "2",
    ratio: look.ratio,
    showSearch: true,
    showDescription: false,
    ...(market ? { style: { ...DEFAULT_BLOCK_STYLE, align: "left" as const } } : {}),
  } as Block);
  blocks.push(contact(d, "Aloqa", "Savollaringiz bo'lsa, yozing yoki qo'ng'iroq qiling."));
  return blocks;
}

export const TEMPLATE_LIST = TEMPLATES.map(({ id, title, description, emoji, theme, look }) => ({ id, title, description, emoji, theme, hero: look.hero, card: look.card }));

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id) as [TemplateId, ...TemplateId[]];

export function buildFromTemplate(id: TemplateId, details: TemplateDetails, categories: string[] = []): Site {
  const tpl = TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
  return siteSchema.parse({
    name: details.businessName,
    tagline: "",
    language: "uz",
    theme: tpl.theme,
    header: { logo: "", showNav: true, ctaText: "", ctaLink: "", variant: "market" },
    footer: { variant: tpl.look.footer, text: "" },
    pages: [{ slug: "home", title: "Bosh sahifa", blocks: buildBlocks(tpl, details, categories) }],
  });
}
