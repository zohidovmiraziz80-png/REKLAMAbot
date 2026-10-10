import { z } from "zod";

/**
 * Sayt tuzilmasi. AI HTML yozmaydi — faqat shu JSON'ni qaytaradi.
 * Har bir matn maydoni kesiladi (uzunlik cheklovi), noma'lum blok turlari tashlab yuboriladi.
 * Bu fayl ham serverda, ham brauzerda ishlatiladi.
 */

const txt = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().slice(0, max))
    .catch("");

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .catch("#0f2d6b");

const id = z.string().min(1).max(64).catch(() => randomId());

export function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

// ===== Bloklar =====

export const heroBlock = z.object({
  type: z.literal("hero"),
  id,
  heading: txt(120),
  subheading: txt(300),
  ctaText: txt(40),
  ctaLink: txt(300),
  align: z.enum(["left", "center"]).catch("center"),
});

export const featuresBlock = z.object({
  type: z.literal("features"),
  id,
  heading: txt(120),
  items: z
    .array(z.object({ icon: txt(8), title: txt(80), text: txt(240) }))
    .max(8)
    .catch([]),
});

export const productsBlock = z.object({
  type: z.literal("products"),
  id,
  heading: txt(120),
  subheading: txt(240),
  items: z
    .array(
      z.object({
        emoji: txt(8),
        name: txt(80),
        price: txt(40),
        description: txt(240),
        badge: txt(24),
      }),
    )
    .max(24)
    .catch([]),
});

/** Jonli katalog: mahsulotlar "Mahsulotlar" bo'limidan olinadi, savat va buyurtma bilan */
export const shopBlock = z.object({
  type: z.literal("shop"),
  id,
  heading: txt(120),
  subheading: txt(240),
});

export const aboutBlock = z.object({
  type: z.literal("about"),
  id,
  heading: txt(120),
  text: txt(1500),
});

export const testimonialsBlock = z.object({
  type: z.literal("testimonials"),
  id,
  heading: txt(120),
  items: z
    .array(z.object({ name: txt(60), role: txt(60), text: txt(400) }))
    .max(12)
    .catch([]),
});

export const faqBlock = z.object({
  type: z.literal("faq"),
  id,
  heading: txt(120),
  items: z
    .array(z.object({ q: txt(200), a: txt(800) }))
    .max(20)
    .catch([]),
});

export const ctaBlock = z.object({
  type: z.literal("cta"),
  id,
  heading: txt(120),
  text: txt(300),
  buttonText: txt(40),
  buttonLink: txt(300),
});

export const contactBlock = z.object({
  type: z.literal("contact"),
  id,
  heading: txt(120),
  text: txt(300),
  phone: txt(30),
  telegram: txt(64),
  instagram: txt(64),
  address: txt(200),
  workingHours: txt(120),
});

export const blockSchema = z.discriminatedUnion("type", [
  heroBlock,
  featuresBlock,
  productsBlock,
  shopBlock,
  aboutBlock,
  testimonialsBlock,
  faqBlock,
  ctaBlock,
  contactBlock,
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export const BLOCK_TYPES: BlockType[] = [
  "hero",
  "features",
  "shop",
  "products",
  "about",
  "testimonials",
  "faq",
  "cta",
  "contact",
];

/** Noma'lum yoki buzilgan bloklarni tashlab, qolganlarini tozalaydi */
const blocksArray = z
  .array(z.unknown())
  .catch([])
  .transform((arr) =>
    arr
      .map((b) => blockSchema.safeParse(b))
      .filter((r) => r.success)
      .map((r) => r.data as Block)
      .slice(0, 30),
  );

// ===== Sahifa va sayt =====

const slug = z
  .string()
  .transform((s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40),
  )
  .catch("");

export const pageSchema = z.object({
  slug,
  title: txt(60),
  blocks: blocksArray,
});

export type SitePage = z.infer<typeof pageSchema>;

export const themeSchema = z.object({
  primary: hex,
  accent: hex.catch("#f7821b"),
  font: z.enum(["modern", "classic", "rounded"]).catch("modern"),
  radius: z.enum(["sharp", "soft", "round"]).catch("soft"),
  mode: z.enum(["light", "dark"]).catch("light"),
});

export type SiteTheme = z.infer<typeof themeSchema>;

export const siteSchema = z
  .object({
    name: txt(60),
    tagline: txt(120),
    language: z.enum(["uz", "ru", "en"]).catch("uz"),
    theme: themeSchema.catch({ primary: "#0f2d6b", accent: "#f7821b", font: "modern", radius: "soft", mode: "light" }),
    pages: z.array(pageSchema).min(1).transform((p) => p.slice(0, 6)),
  })
  .transform((site) => {
    // Sahifa slug'larini noyob qilamiz, birinchi sahifa doim "home"
    const seen = new Set<string>();
    site.pages = site.pages.map((p, i) => {
      let s = i === 0 ? "home" : p.slug || `sahifa-${i + 1}`;
      while (seen.has(s)) s = `${s}-${i + 1}`;
      seen.add(s);
      return { ...p, slug: s, title: p.title || (i === 0 ? "Bosh sahifa" : `Sahifa ${i + 1}`) };
    });
    // Blok id'lari noyob bo'lsin
    const ids = new Set<string>();
    for (const p of site.pages) {
      for (const b of p.blocks) {
        while (!b.id || ids.has(b.id)) b.id = randomId();
        ids.add(b.id);
      }
    }
    if (!site.name) site.name = "Mening saytim";
    return site;
  });

export type Site = z.output<typeof siteSchema>;

/** Tahrirlovchida yangi blok qo'shilganda ishlatiladigan boshlang'ich qiymatlar */
export function defaultBlock(type: BlockType): Block {
  const base = { id: randomId() };
  switch (type) {
    case "hero":
      return { ...base, type, heading: "Sarlavha", subheading: "Qisqa tavsif", ctaText: "Bog'lanish", ctaLink: "#aloqa", align: "center" };
    case "features":
      return {
        ...base,
        type,
        heading: "Afzalliklarimiz",
        items: [
          { icon: "⚡", title: "Tez yetkazish", text: "Qisqa izoh" },
          { icon: "✅", title: "Sifat kafolati", text: "Qisqa izoh" },
          { icon: "💬", title: "Qulay aloqa", text: "Qisqa izoh" },
        ],
      };
    case "products":
      return {
        ...base,
        type,
        heading: "Mahsulotlar",
        subheading: "",
        items: [{ emoji: "📦", name: "Mahsulot nomi", price: "", description: "Qisqa tavsif", badge: "" }],
      };
    case "shop":
      return { ...base, type, heading: "Katalog", subheading: "Savatga qo'shing va onlayn buyurtma bering" };
    case "about":
      return { ...base, type, heading: "Biz haqimizda", text: "Biznesingiz haqida bir necha jumla." };
    case "testimonials":
      return {
        ...base,
        type,
        heading: "Mijozlar fikri",
        items: [{ name: "Mijoz ismi", role: "", text: "Bu yerga haqiqiy mijozingiz fikrini yozing." }],
      };
    case "faq":
      return { ...base, type, heading: "Ko'p beriladigan savollar", items: [{ q: "Savol?", a: "Javob." }] };
    case "cta":
      return { ...base, type, heading: "Buyurtma bering", text: "", buttonText: "Bog'lanish", buttonLink: "#aloqa" };
    case "contact":
      return { ...base, type, heading: "Aloqa", text: "", phone: "", telegram: "", instagram: "", address: "", workingHours: "" };
  }
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Bosh banner",
  features: "Afzalliklar",
  shop: "Do'kon (katalog + savat)",
  products: "Mahsulotlar / xizmatlar (qo'lda)",
  about: "Biz haqimizda",
  testimonials: "Mijozlar fikri",
  faq: "Savol-javob",
  cta: "Chaqiriq (tugma)",
  contact: "Aloqa",
};
