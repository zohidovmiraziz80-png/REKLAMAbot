import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { getWorkspacePlan } from "@/lib/plans";

/**
 * Eskiz SMS (https://notify.eskiz.uz/api).
 * POST /auth/login {email, password} → data.token (taxminan 30 kun); POST /message/sms/send {mobile_phone, message, from}.
 * Eskiz SMS matnlarini oldindan moderatsiyadan o'tkazadi — shablonlarni Eskiz kabinetida tasdiqlatish kerak.
 */

const BASE = "https://notify.eskiz.uz/api";

export const DEFAULT_TPL_NEW = "{dokon}: buyurtmangiz №{nomer} qabul qilindi. Summa: {summa} so'm.";
export const DEFAULT_TPL_STATUS = "{dokon}: buyurtma №{nomer} holati: {holat}.";

export const eskizSettingsSchema = z.object({
  email: z.string().trim().email("Email noto'g'ri").max(120),
  from: z.string().trim().max(11).default("4546"),
  onNew: z.boolean().default(true),
  onStatus: z.boolean().default(true),
  onlyWithoutTelegram: z.boolean().default(true),
  shopName: z.string().trim().max(40).default(""),
  tplNew: z.string().trim().max(300).default(DEFAULT_TPL_NEW),
  tplStatus: z.string().trim().max(300).default(DEFAULT_TPL_STATUS),
});
export type EskizSettings = z.infer<typeof eskizSettingsSchema>;
export type EskizConfig = EskizSettings & { password: string };

export class EskizError extends Error {}

const tokens = new Map<string, { token: string; until: number }>();

async function login(email: string, password: string, fresh = false): Promise<string> {
  const hit = tokens.get(email);
  if (!fresh && hit && hit.until > Date.now()) return hit.token;
  const form = new URLSearchParams({ email, password });
  const res = await fetch(`${BASE}/auth/login`, { method: "POST", body: form, cache: "no-store", signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res) throw new EskizError("Eskiz bilan aloqa yo'q");
  const json = (await res.json().catch(() => ({}))) as { data?: { token?: string }; message?: string };
  if (!res.ok || !json.data?.token) throw new EskizError("Eskiz: email yoki parol noto'g'ri");
  tokens.set(email, { token: json.data.token, until: Date.now() + 20 * 86_400_000 });
  return json.data.token;
}

export const testEskizLogin = (email: string, password: string) => login(email, password, true);

export async function sendSms(cfg: Pick<EskizConfig, "email" | "password" | "from">, phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const mobile = digits.length === 9 ? `998${digits}` : digits;
  if (!/^998\d{9}$/.test(mobile)) throw new EskizError("Telefon raqami O'zbekiston raqami emas");
  const post = async (token: string) =>
    fetch(`${BASE}/message/sms/send`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: new URLSearchParams({ mobile_phone: mobile, message: message.slice(0, 600), from: cfg.from || "4546" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  let res = await post(await login(cfg.email, cfg.password));
  if (res.status === 401) res = await post(await login(cfg.email, cfg.password, true));
  const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; message?: string | Record<string, unknown> };
  if (!res.ok || json.status === "error") {
    const m = typeof json.message === "string" ? json.message : "";
    throw new EskizError(m ? `Eskiz: ${m}` : `Eskiz xatosi (${res.status})`);
  }
  return json.id ?? null;
}

export async function loadEskiz(db: SupabaseClient, workspaceId: string): Promise<EskizConfig | null> {
  const { data } = await db.from("integrations").select("status, settings, credentials_encrypted").eq("workspace_id", workspaceId).eq("provider", "eskiz").maybeSingle();
  if (!data || data.status !== "active") return null;
  const s = eskizSettingsSchema.safeParse(data.settings);
  if (!s.success) return null;
  try {
    const c = JSON.parse(decryptSecret(data.credentials_encrypted as string)) as { password?: string };
    return c.password ? { ...s.data, password: c.password } : null;
  } catch {
    return null;
  }
}

const STATUS_UZ: Record<string, string> = {
  confirmed: "tasdiqlandi",
  delivering: "yo'lga chiqdi",
  done: "yakunlandi",
  cancelled: "bekor qilindi",
};

function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

/** Buyurtma bo'yicha mijozga SMS (sozlamalarga qarab). Xato bo'lsa jim o'tadi. */
export async function sendOrderSms(
  db: SupabaseClient,
  order: { workspace_id: string; number: number; phone?: string | null; chat_id?: number | null; total?: number | null },
  kind: "new" | "status",
  status?: string,
) {
  try {
    const cfg = await loadEskiz(db, order.workspace_id);
    if (!cfg) return;
    if (kind === "new" && !cfg.onNew) return;
    if (kind === "status" && (!cfg.onStatus || !status || !STATUS_UZ[status])) return;
    if (cfg.onlyWithoutTelegram && order.chat_id) return;
    const plan = await getWorkspacePlan(db, order.workspace_id);
    if (!plan.integrations) return;
    let phone = order.phone ?? null;
    let total = order.total ?? null;
    if (!phone || total == null) {
      const { data } = await db.from("orders").select("phone, total").eq("workspace_id", order.workspace_id).eq("number", order.number).maybeSingle();
      phone = phone ?? ((data?.phone as string | undefined) ?? null);
      total = total ?? ((data?.total as number | undefined) ?? null);
    }
    if (!phone) return;
    const text = fill(kind === "new" ? cfg.tplNew : cfg.tplStatus, {
      dokon: cfg.shopName || "Do'kon",
      nomer: String(order.number),
      summa: total != null ? Number(total).toLocaleString("ru-RU").replace(/,/g, " ") : "",
      holat: status ? (STATUS_UZ[status] ?? status) : "",
    });
    await sendSms(cfg, phone, text);
  } catch (err) {
    console.error("SMS yuborilmadi:", err instanceof Error ? err.message : "xato");
  }
}
