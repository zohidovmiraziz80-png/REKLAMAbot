import { z } from "zod";

/**
 * Bot sozlamalari (menyu va javoblar). Server va brauzerda ishlatiladi.
 */

const txt = (max: number, fallback = "") =>
  z
    .string()
    .transform((s) => s.trim().slice(0, max))
    .catch(fallback);

export const BUTTON_TYPES = ["webapp", "orders", "text", "link", "request"] as const;
export type BotButtonType = (typeof BUTTON_TYPES)[number];

export const BUTTON_TYPE_LABELS: Record<BotButtonType, string> = {
  webapp: "Saytni bot ichida ochish (Mini App)",
  orders: "Buyurtmalarim (mijoz o'z buyurtmalarini ko'radi)",
  text: "Matnli javob",
  request: "Ariza / buyurtma qabul qilish",
  link: "Havola (sayt, kanal)",
};

export const botButtonSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(32)
    .catch(() => Math.random().toString(36).slice(2, 10)),
  label: txt(40),
  type: z.enum(BUTTON_TYPES).catch("text"),
  text: txt(2000),
  url: txt(300),
  /** Tugma butun qatorni egallaydi */
  wide: z.boolean().catch(false),
});

export type BotButton = z.output<typeof botButtonSchema>;

export const DEFAULT_TEXTS = {
  welcome: "Assalomu alaykum! Kerakli bo'limni tanlang 👇",
  requestPhonePrompt: "Telefon raqamingizni yuboring — pastdagi tugmani bosing yoki raqamni yozing.",
  requestMessagePrompt: "Nima buyurtma qilmoqchisiz yoki savolingiz nima? Bitta xabarda yozing.",
  requestThanks: "Rahmat! Arizangiz qabul qilindi. Tez orada siz bilan bog'lanamiz ✅",
};

export const botConfigSchema = z.object({
  welcome: txt(1000, DEFAULT_TEXTS.welcome),
  buttons: z
    .array(z.unknown())
    .catch([])
    .transform((arr) =>
      arr
        .flatMap((b) => {
          const r = botButtonSchema.safeParse(b);
          return r.success ? [r.data] : [];
        })
        .filter((b) => b.label)
        .slice(0, 12),
    ),
  requestPhonePrompt: txt(300, DEFAULT_TEXTS.requestPhonePrompt),
  requestMessagePrompt: txt(300, DEFAULT_TEXTS.requestMessagePrompt),
  requestThanks: txt(300, DEFAULT_TEXTS.requestThanks),
  /** Xabar yozish maydoni yonidagi menyu tugmasi ochadigan sayt (Mini App) */
  siteUrl: txt(300),
  menuButtonText: txt(20, "Do'kon"),
  /** AI yordamchi: botda erkin savollarga javob beradi */
  aiBot: z.boolean().catch(false),
  /** AI konsultant: saytda chat oynasi */
  aiSite: z.boolean().catch(false),
  /** AI uchun qo'shimcha ma'lumot va ohang (ish vaqti, kafolat, yetkazish shartlari...) */
  aiInstructions: txt(2000),
  /** Mahsulot postlari chiqadigan Telegram kanal */
  postChannelId: z.number().nullable().catch(null),
  postChannelTitle: txt(120),
  autoPostNew: z.boolean().catch(false),
  /** Do'kon kuryerlari (botga /start courier_<kod> orqali ulanadi) */
  couriers: z
    .array(z.object({ chatId: z.number(), name: txt(80, "Kuryer") }))
    .catch([])
    .transform((a) => a.slice(0, 30)),
  /** Buyurtma va to'lov xabarlarini oladigan qo'shimcha adminlar (Telegram ID) */
  adminChatIds: z
    .array(z.number().int())
    .catch([])
    .transform((a) => [...new Set(a)].slice(0, 20)),
  /** Tashlab ketilgan savat eslatmasi */
  abandonEnabled: z.boolean().catch(false),
  abandonHours: z.number().min(1).max(48).catch(2),
  abandonText: txt(500),
});

export type BotConfig = z.output<typeof botConfigSchema>;

export function defaultBotConfig(businessName: string, siteUrl = ""): BotConfig {
  return {
    welcome: `Assalomu alaykum! ${businessName} botiga xush kelibsiz. Kerakli bo'limni tanlang 👇`,
    buttons: [
      { id: "shop", label: "🛍 Do'konni ochish", type: "webapp", text: "", url: siteUrl, wide: true },
      { id: "orders", label: "📦 Buyurtmalarim", type: "orders", text: "", url: "", wide: false },
      { id: "contact", label: "☎️ Aloqa", type: "text", text: `${businessName}\nTelefon: \nManzil: \nIsh vaqti: `, url: "", wide: false },
    ],
    requestPhonePrompt: DEFAULT_TEXTS.requestPhonePrompt,
    requestMessagePrompt: DEFAULT_TEXTS.requestMessagePrompt,
    requestThanks: DEFAULT_TEXTS.requestThanks,
    siteUrl,
    menuButtonText: "Do'kon",
    aiBot: false,
    aiSite: false,
    aiInstructions: "",
    postChannelId: null,
    postChannelTitle: "",
    autoPostNew: false,
    couriers: [],
    adminChatIds: [],
    abandonEnabled: false,
    abandonHours: 2,
    abandonText: "",
  };
}

/** Tugmalarni qatorlarga ajratadi: "wide" tugma alohida qator, qolganlari ikkitadan */
export function buttonRows(buttons: BotButton[]): BotButton[][] {
  const rows: BotButton[][] = [];
  let pending: BotButton | null = null;
  for (const b of buttons) {
    if (b.wide) {
      if (pending) {
        rows.push([pending]);
        pending = null;
      }
      rows.push([b]);
    } else if (pending) {
      rows.push([pending, b]);
      pending = null;
    } else {
      pending = b;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}

/** Mini App uchun faqat https manzil */
export function safeWebAppUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Telegram'da ochiladigan xavfsiz havola (faqat https) */
export function safeBotUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^@[\w]{3,32}$/.test(v)) return `https://t.me/${v.slice(1)}`;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
