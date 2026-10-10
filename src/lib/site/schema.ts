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

/** Faqat https rasm manzili (aks holda bo'sh) */
const imageUrl = z
  .string()
  .transform((s) => {
    const v = s.trim().slice(0, 500);
    return /^https:\/\/[^\s"'<>()]+$/.test(v) ? v : "";
  })
  .catch("");

/** Eski saqlangan saytlar buzilmasligi uchun yangi maydonlar ixtiyoriy */
const opt = <T extends z.ZodTypeAny>(schema: T) => schema.optional().catch(undefined);

/** Har bir blok uchun dizayn: fon, bo'shliq, sarlavha joylashuvi */
export const blockStyleSchema = z.object({
  bg: z.enum(["default", "surface", "primary", "accent", "dark", "custom", "image"]).catch("default"),
  bgColor: hex.catch("#f5f7fb"),
  bgImage: imageUrl,
  pad: z.enum(["sm", "md", "lg"]).catch("md"),
  align: z.enum(["left", "center"]).catch("center"),
});
export type BlockStyle = z.output<typeof blockStyleSchema>;
export const DEFAULT_BLOCK_STYLE: BlockStyle = { bg: "default", bgColor: "#f5f7fb", bgImage: "", pad: "md", align: "center" };
const style = opt(blockStyleSchema);
/** Blokning tayyor dizayn varianti (har blok turi uchun o'z ro'yxati, noma'lum bo'lsa — standart) */
const variant = opt(z.string().max(24));

// ===== Bloklar =====

export const heroBlock = z.object({
  type: z.literal("hero"),
  id,
  style,
  variant,
  /** Fon yoki yon rasm */
  image: opt(imageUrl),
  imageMode: opt(z.enum(["background", "side"])),
  heading: txt(120),
  subheading: txt(300),
  ctaText: txt(40),
  ctaLink: txt(300),
  align: z.enum(["left", "center"]).catch("center"),
});

export const featuresBlock = z.object({
  type: z.literal("features"),
  id,
  style,
  variant,
  heading: txt(120),
  items: z
    .array(z.object({ icon: txt(8), title: txt(80), text: txt(240) }))
    .max(8)
    .catch([]),
});

export const productsBlock = z.object({
  type: z.literal("products"),
  id,
  style,
  variant,
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
  style,
  variant,
  heading: txt(120),
  subheading: txt(240),
  /** Faqat shu kategoriya (bo'sh = hammasi) — har xil joyda alohida kataloglar qo'yish uchun */
  category: opt(txt(60)),
  limit: opt(z.number().int().min(0).max(48)),
  columns: opt(z.enum(["2", "3", "4", "5"])),
  mobileColumns: opt(z.enum(["1", "2"])),
  card: opt(z.enum(["border", "shadow", "flat", "market"])),
  ratio: opt(z.enum(["square", "portrait", "landscape"])),
  showDescription: opt(z.boolean()),
  showSearch: opt(z.boolean()),
});

export const imageBlock = z.object({
  type: z.literal("image"),
  id,
  style,
  variant,
  src: imageUrl,
  alt: txt(120),
  caption: txt(200),
  link: txt(300),
  width: z.enum(["contained", "full"]).catch("contained"),
});

export const galleryBlock = z.object({
  type: z.literal("gallery"),
  id,
  style,
  variant,
  heading: txt(120),
  images: z
    .array(z.object({ src: imageUrl, caption: txt(120) }))
    .max(24)
    .catch([]),
  columns: z.enum(["2", "3", "4"]).catch("3"),
});

export const textBlock = z.object({
  type: z.literal("text"),
  id,
  style,
  variant,
  heading: txt(120),
  text: txt(4000),
});

export const aboutBlock = z.object({
  type: z.literal("about"),
  id,
  style,
  variant,
  image: opt(imageUrl),
  heading: txt(120),
  text: txt(1500),
});

export const testimonialsBlock = z.object({
  type: z.literal("testimonials"),
  id,
  style,
  variant,
  heading: txt(120),
  items: z
    .array(z.object({ name: txt(60), role: txt(60), text: txt(400) }))
    .max(12)
    .catch([]),
});

export const faqBlock = z.object({
  type: z.literal("faq"),
  id,
  style,
  variant,
  heading: txt(120),
  items: z
    .array(z.object({ q: txt(200), a: txt(800) }))
    .max(20)
    .catch([]),
});

export const ctaBlock = z.object({
  type: z.literal("cta"),
  id,
  style,
  variant,
  heading: txt(120),
  text: txt(300),
  buttonText: txt(40),
  buttonLink: txt(300),
});

export const contactBlock = z.object({
  type: z.literal("contact"),
  id,
  style,
  variant,
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
  imageBlock,
  galleryBlock,
  textBlock,
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
  "image",
  "gallery",
  "text",
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
    /** Sayt yuqori qismi: logotip, menyu, tugma */
    header: opt(
      z.object({
        logo: imageUrl,
        showNav: z.boolean().catch(true),
        ctaText: txt(30),
        ctaLink: txt(300),
        variant: opt(z.enum(["classic", "centered", "dark", "market"])),
      }),
    ),
    footer: opt(
      z.object({
        variant: z.enum(["simple", "columns", "dark"]).catch("simple"),
        text: txt(300),
      }),
    ),
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
    case "image":
      return { ...base, type, src: "", alt: "", caption: "", link: "", width: "contained" };
    case "gallery":
      return { ...base, type, heading: "Galereya", images: [], columns: "3" };
    case "text":
      return { ...base, type, heading: "Sarlavha", text: "Matningizni shu yerga yozing." };
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
  image: "Rasm / banner",
  gallery: "Galereya",
  text: "Matn",
  products: "Mahsulotlar / xizmatlar (qo'lda)",
  about: "Biz haqimizda",
  testimonials: "Mijozlar fikri",
  faq: "Savol-javob",
  cta: "Chaqiriq (tugma)",
  contact: "Aloqa",
};

/** Har blok turi uchun tayyor dizaynlar (bloklar kutubxonasi) */
export const BLOCK_VARIANTS: Partial<Record<BlockType, { id: string; label: string }[]>> = {
  hero: [
    { id: "classic", label: "Rangli fon" },
    { id: "split", label: "Matn + rasm" },
    { id: "image", label: "Katta rasm" },
    { id: "minimal", label: "Minimal" },
    { id: "promo", label: "Promo banner" },
  ],
  features: [
    { id: "cards", label: "Kartochkalar" },
    { id: "icons", label: "Ikonkalar" },
    { id: "list", label: "Ro'yxat" },
    { id: "strip", label: "Ixcham qator" },
  ],
  about: [
    { id: "simple", label: "Oddiy" },
    { id: "split", label: "Rasm yonida" },
    { id: "card", label: "Kartochka" },
  ],
  testimonials: [
    { id: "cards", label: "Kartochkalar" },
    { id: "quote", label: "Katta iqtibos" },
  ],
  faq: [
    { id: "accordion", label: "Ochiladigan" },
    { id: "columns", label: "Ikki ustun" },
  ],
  cta: [
    { id: "banner", label: "Banner" },
    { id: "bar", label: "Qator" },
    { id: "minimal", label: "Minimal" },
  ],
  contact: [
    { id: "cards", label: "Kartochkalar" },
    { id: "split", label: "Ikki qism" },
    { id: "minimal", label: "Minimal" },
  ],
};
