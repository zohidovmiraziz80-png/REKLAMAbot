import { siteSchema, type Block, type Site } from "./schema";

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

export type TemplateId = "shop" | "flowers" | "food" | "services" | "beauty" | "blank";

type TemplateDef = {
  id: TemplateId;
  title: string;
  description: string;
  emoji: string;
  theme: Site["theme"];
  build: (d: TemplateDetails) => Block[];
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
    id: "shop",
    title: "Onlayn do'kon",
    description: "Kiyim, aksessuar, texnika va boshqa mahsulotlar",
    emoji: "🛍️",
    theme: { primary: "#0f2d6b", accent: "#f7821b", font: "modern", radius: "soft", mode: "light" },
    build: (d) => [
      {
        type: "hero",
        variant: "split",
        id: bid(),
        heading: `${d.businessName} — sifatli mahsulotlar qulay narxda`,
        subheading: "Buyurtma bering, biz tez yetkazib beramiz.",
        ctaText: "Mahsulotlarni ko'rish",
        ctaLink: "#katalog",
        align: "center",
      },
      {
        type: "features",
        id: bid(),
        heading: "Nega aynan biz?",
        items: [
          { icon: "🚚", title: "Tez yetkazish", text: "Buyurtmangizni qisqa muddatda yetkazamiz." },
          { icon: "✅", title: "Sifat kafolati", text: "Har bir mahsulot tekshirib jo'natiladi." },
          { icon: "💬", title: "Doimo aloqada", text: "Savollaringizga tez javob beramiz." },
        ],
      },
      { type: "shop", id: bid(), heading: "Mahsulotlar", subheading: "Savatga qo'shing va onlayn buyurtma bering" },
      {
        type: "faq",
        id: bid(),
        heading: "Ko'p beriladigan savollar",
        items: [
          { q: "Qanday buyurtma beraman?", a: "Mahsulotni savatga qo'shing va \"Rasmiylashtirish\" tugmasini bosing. Telegram bot orqali ham buyurtma berish mumkin." },
          { q: "Yetkazib berish qancha turadi?", a: "Narx manzilga bog'liq. Buyurtma paytida aytamiz." },
          { q: "Mahsulotni qaytarsa bo'ladimi?", a: "Shartlarni bilish uchun biz bilan bog'laning." },
        ],
      },
      { type: "cta", id: bid(), heading: "Buyurtma berishga tayyormisiz?", text: "Hoziroq yozing — tez javob beramiz.", buttonText: "Bog'lanish", buttonLink: "#aloqa" },
      contact(d),
    ],
  },
  {
    id: "flowers",
    title: "Gul do'koni",
    description: "Buketlar, gul savatlari va sovg'alar",
    emoji: "💐",
    theme: { primary: "#7a1f4b", accent: "#e8457b", font: "rounded", radius: "round", mode: "light" },
    build: (d) => [
      {
        type: "hero",
        variant: "classic",
        id: bid(),
        heading: `${d.businessName} — yangi uzilgan gullar`,
        subheading: "Har qanday bayram uchun chiroyli buketlar. Shahar bo'ylab yetkazib beramiz.",
        ctaText: "Buket tanlash",
        ctaLink: "#katalog",
        align: "center",
      },
      { type: "shop", id: bid(), heading: "Buketlarimiz", subheading: "Buketni tanlang, savatga qo'shing — yetkazib beramiz" },
      {
        type: "features",
        variant: "icons",
        id: bid(),
        heading: "Biz bilan qulay",
        items: [
          { icon: "🌸", title: "Har doim yangi", text: "Gullar har kuni yangilanadi." },
          { icon: "🚗", title: "Yetkazib berish", text: "Shahar bo'ylab tez yetkazamiz." },
          { icon: "💌", title: "Tabriknoma", text: "Buketga istak matnini qo'shamiz." },
        ],
      },
      { type: "cta", id: bid(), heading: "Yaqinlaringizni xursand qiling", text: "Buyurtmani hoziroq bering.", buttonText: "Buyurtma berish", buttonLink: "#aloqa" },
      contact(d),
    ],
  },
  {
    id: "food",
    title: "Kafe / taom yetkazish",
    description: "Restoran, kafe, fast-food, uy taomlari",
    emoji: "🍽️",
    theme: { primary: "#3b1f0f", accent: "#e8590c", font: "rounded", radius: "soft", mode: "light" },
    build: (d) => [
      {
        type: "hero",
        variant: "image",
        id: bid(),
        heading: `${d.businessName} — mazali taomlar`,
        subheading: "Issiq va yangi taomlar. Kafeda yoki yetkazib berish bilan.",
        ctaText: "Menyuni ko'rish",
        ctaLink: "#katalog",
        align: "center",
      },
      { type: "shop", id: bid(), heading: "Menyu", subheading: "Savatga qo'shing va buyurtma bering" },
      {
        type: "about",
        id: bid(),
        heading: "Biz haqimizda",
        text: "Bu yerda kafe yoki oshxonangiz haqida yozing: qachondan beri ishlaysiz, nimasi bilan alohida.",
      },
      contact(d, "Buyurtma va manzil", "Yetkazib berish uchun qo'ng'iroq qiling yoki Telegram'da yozing."),
    ],
  },
  {
    id: "services",
    title: "Xizmatlar",
    description: "Ta'mirlash, o'quv markazi, yuridik va boshqa xizmatlar",
    emoji: "🛠️",
    theme: { primary: "#12355b", accent: "#2bb673", font: "modern", radius: "sharp", mode: "light" },
    build: (d) => [
      {
        type: "hero",
        variant: "minimal",
        id: bid(),
        heading: `${d.businessName} — ishonchli xizmat`,
        subheading: "Tajribali mutaxassislar, aniq muddat va halol narx.",
        ctaText: "Ariza qoldirish",
        ctaLink: "#aloqa",
        align: "left",
      },
      {
        type: "products",
        id: bid(),
        heading: "Xizmatlarimiz",
        subheading: "",
        items: [
          { emoji: "🔧", name: "Xizmat 1", price: "", description: "Qisqa tavsif", badge: "" },
          { emoji: "📐", name: "Xizmat 2", price: "", description: "Qisqa tavsif", badge: "" },
          { emoji: "📋", name: "Xizmat 3", price: "", description: "Qisqa tavsif", badge: "" },
        ],
      },
      {
        type: "features",
        id: bid(),
        heading: "Qanday ishlaymiz",
        items: [
          { icon: "1️⃣", title: "Ariza", text: "Siz ariza qoldirasiz yoki qo'ng'iroq qilasiz." },
          { icon: "2️⃣", title: "Kelishuv", text: "Ish hajmi va narxini kelishib olamiz." },
          { icon: "3️⃣", title: "Natija", text: "Ishni o'z vaqtida topshiramiz." },
        ],
      },
      { type: "about", id: bid(), heading: "Biz haqimizda", text: "Kompaniyangiz haqida 2-3 jumla yozing." },
      contact(d, "Ariza qoldiring", "Qo'ng'iroq qiling yoki yozing — tez orada bog'lanamiz."),
    ],
  },
  {
    id: "beauty",
    title: "Go'zallik saloni",
    description: "Salon, barbershop, manikyur, kosmetologiya",
    emoji: "💅",
    theme: { primary: "#2d1b3d", accent: "#c08457", font: "classic", radius: "soft", mode: "dark" },
    build: (d) => [
      {
        type: "hero",
        variant: "split",
        id: bid(),
        heading: `${d.businessName}`,
        subheading: "Sizning go'zalligingiz — bizning ishimiz. Oldindan yoziling.",
        ctaText: "Yozilish",
        ctaLink: "#aloqa",
        align: "center",
      },
      {
        type: "products",
        id: bid(),
        heading: "Xizmatlar",
        subheading: "",
        items: [
          { emoji: "💇", name: "Soch turmagi", price: "", description: "Qisqa tavsif", badge: "" },
          { emoji: "💅", name: "Manikyur", price: "", description: "Qisqa tavsif", badge: "" },
          { emoji: "✨", name: "Yuz parvarishi", price: "", description: "Qisqa tavsif", badge: "" },
        ],
      },
      { type: "about", id: bid(), heading: "Ustalarimiz", text: "Ustalaringiz va tajribangiz haqida yozing." },
      contact(d, "Yozilish", "Qulay vaqtni tanlash uchun qo'ng'iroq qiling yoki Telegram'da yozing."),
    ],
  },
  {
    id: "blank",
    title: "Bo'sh sayt",
    description: "Faqat sarlavha va aloqa — qolganini o'zingiz qo'shasiz",
    emoji: "📄",
    theme: { primary: "#0f2d6b", accent: "#f7821b", font: "modern", radius: "soft", mode: "light" },
    build: (d) => [
      {
        type: "hero",
        variant: "classic",
        id: bid(),
        heading: d.businessName,
        subheading: "Bu yerga qisqa tavsif yozing.",
        ctaText: "Bog'lanish",
        ctaLink: "#aloqa",
        align: "center",
      },
      contact(d),
    ],
  },
];

export const TEMPLATE_LIST = TEMPLATES.map(({ id, title, description, emoji, theme }) => ({ id, title, description, emoji, theme }));

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id) as [TemplateId, ...TemplateId[]];

export function buildFromTemplate(id: TemplateId, details: TemplateDetails): Site {
  const tpl = TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[TEMPLATES.length - 1];
  return siteSchema.parse({
    name: details.businessName,
    tagline: "",
    language: "uz",
    theme: tpl.theme,
    header: { logo: "", showNav: true, ctaText: "", ctaLink: "", variant: id === "beauty" ? "centered" : "classic" },
    footer: { variant: id === "blank" ? "simple" : "columns", text: "" },
    pages: [{ slug: "home", title: "Bosh sahifa", blocks: tpl.build(details) }],
  });
}
