import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanId = "bot" | "site" | "site_bot" | "business";
export type PlanStatus = "trial" | "active" | "expired";

export type Plan = {
  id: PlanId;
  name: string;
  description: string;
  price_uzs: number | null;
  sort: number;
};

/** Tarif imkoniyatlari (kod ichida — bazadagi eski allow_* ustunlariga bog'liq emas) */
export type PlanCaps = {
  /** Sayt yaratish, tahrirlash va nashr qilish */
  sites: boolean;
  /** Sayt brauzerda hamma uchun ochiq (aks holda faqat Telegram Mini App ichida) */
  sitePublic: boolean;
  /** Telegram bot ulash */
  bots: boolean;
  /** Botda to'liq do'kon: menyu tugmalari, Mini App, buyurtmalar (aks holda bot faqat tasdiqlash va xabarlar uchun) */
  botShop: boolean;
  /** Integratsiyalar: Bito, Payme, Click, Multicard */
  integrations: boolean;
};

export const PLAN_DEFS: Record<PlanId, { name: string; description: string; sort: number; caps: PlanCaps; features: string[] }> = {
  bot: {
    name: "Bot",
    description: "Telegram bot do'kon: sayt faqat bot ichida (Mini App) ochiladi",
    sort: 1,
    caps: { sites: true, sitePublic: false, bots: true, botShop: true, integrations: false },
    features: ["Telegram bot: menyu, javoblar, arizalar", "Bot ichida do'kon (Mini App)", "Buyurtmalar va mijozlar", "Sayt brauzerda ochilmaydi — faqat botda"],
  },
  site: {
    name: "Sayt",
    description: "Internet do'kon sayti; bot faqat mijozni tasdiqlash va xabarlar uchun",
    sort: 2,
    caps: { sites: true, sitePublic: true, bots: true, botShop: false, integrations: false },
    features: ["Tayyor shablonlar va tahrirlovchi", "Internetga nashr qilish, o'z domeni", "Mijoz kabineti (Telegram orqali kirish)", "Bot: faqat tasdiqlash va buyurtma xabarlari"],
  },
  site_bot: {
    name: "Sayt + Bot",
    description: "Sayt va bot birga — to'liq internet do'kon",
    sort: 3,
    caps: { sites: true, sitePublic: true, bots: true, botShop: true, integrations: false },
    features: ["Sayt tarifidagi hammasi", "Bot tarifidagi hammasi", "Sayt bot ichida Mini App bo'lib ochiladi", "Kartaga o'tkazma (SMS orqali avto-tasdiq)"],
  },
  business: {
    name: "Biznes",
    description: "Sayt + Bot va barcha integratsiyalar",
    sort: 4,
    caps: { sites: true, sitePublic: true, bots: true, botShop: true, integrations: true },
    features: ["Sayt + Bot tarifidagi hammasi", "Bito: mahsulot, narx, qoldiq va buyurtmalar", "Payme, Click, Multicard onlayn to'lov", "Yetkazish xizmatlari (tez orada)"],
  },
};

const ALL_CAPS: PlanCaps = PLAN_DEFS.business.caps;
const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && v in PLAN_DEFS;

export type WorkspacePlan = {
  planId: PlanId;
  planName: string;
  /** Hisoblangan holat: sinov muddati o'tgan bo'lsa "expired" */
  status: PlanStatus;
  trialEndsAt: string | null;
  daysLeft: number | null;
  active: boolean;
  allowSites: boolean;
  allowBots: boolean;
  sitePublic: boolean;
  botShop: boolean;
  integrations: boolean;
};

/** Tariflar ro'yxati: nom va tavsif koddan, narx bazadan (admin o'zgartiradi) */
export async function listPlans(supabase: SupabaseClient): Promise<Plan[]> {
  const { data } = await supabase.from("plans").select("id, price_uzs");
  const prices = new Map((data ?? []).map((r) => [r.id as string, (r.price_uzs as number | null) ?? null]));
  return (Object.keys(PLAN_DEFS) as PlanId[])
    .map((id) => ({ id, name: PLAN_DEFS[id].name, description: PLAN_DEFS[id].description, price_uzs: prices.get(id) ?? null, sort: PLAN_DEFS[id].sort }))
    .sort((a, b) => a.sort - b.sort);
}

export async function getWorkspacePlan(supabase: SupabaseClient, workspaceId: string): Promise<WorkspacePlan> {
  const { data } = await supabase.from("workspaces").select("plan_id, plan_status, trial_ends_at").eq("id", workspaceId).maybeSingle();

  const trialEndsAt = (data?.trial_ends_at as string | null | undefined) ?? null;
  let status = ((data?.plan_status as PlanStatus | undefined) ?? "trial") as PlanStatus;
  let daysLeft: number | null = null;
  if (status === "trial") {
    const ms = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : -1;
    if (ms <= 0) status = "expired";
    else daysLeft = Math.ceil(ms / 86_400_000);
  }
  const active = status === "active" || status === "trial";
  const rawPlan: unknown = data?.plan_id;
  const planId: PlanId = isPlanId(rawPlan) ? rawPlan : "site_bot";
  // Sinov muddatida hamma imkoniyat ochiq
  const caps = status === "trial" ? ALL_CAPS : PLAN_DEFS[planId].caps;

  return {
    planId,
    planName: PLAN_DEFS[planId].name,
    status,
    trialEndsAt,
    daysLeft,
    active,
    allowSites: active && caps.sites,
    allowBots: active && caps.bots,
    // Nashr qilingan sayt va bot muddat tugasa ham ishlaydi — faqat tarif turi cheklaydi
    sitePublic: caps.sitePublic,
    botShop: caps.botShop,
    integrations: active && caps.integrations,
  };
}

export function formatPrice(price: number | null) {
  if (price === null) return "Narxi tez orada";
  return `${price.toLocaleString("ru-RU").replace(/,/g, " ")} so'm / oy`;
}
