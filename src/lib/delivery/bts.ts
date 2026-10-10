import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { normalizeUzPhone } from "@/lib/phone";
import { notifyCustomerStatus, notifyCustomerText } from "@/lib/shop/notify";
import type { OrderStatus } from "@/lib/shop/format";

/**
 * BTS Express API (https://docs.bts.uz).
 * Avtorizatsiya: POST /auth/login {login, password} → access_token (24 soat), keyin "Authorization: Bearer ...".
 * Server manzili BTS tomonidan beriladi (test: https://apitest.bts.uz:28345).
 */

export const BTS_TEST_URL = "https://apitest.bts.uz:28345";

export const btsSettingsSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .regex(/^https:\/\/[a-z0-9.-]+\.bts\.uz(:\d{2,5})?\/?$/i, "Server manzili https://...bts.uz ko'rinishida bo'lishi kerak")
    .default(BTS_TEST_URL),
  senderName: z.string().trim().min(2, "Jo'natuvchi nomini kiriting").max(80),
  senderPhone: z.string().trim().min(9, "Telefon raqamini kiriting").max(20),
  senderAddress: z.string().trim().min(5, "Jo'natish manzilini kiriting").max(300),
  senderRegionCode: z.string().trim().max(10).default(""),
  senderCityCode: z.string().trim().min(2, "Jo'natuvchi shahar/tumanini tanlang").max(10),
  pickupType: z.enum(["courier", "self"]).default("courier"),
  defaultWeight: z.number().min(0.1).max(100).default(1),
});
export type BtsSettings = z.infer<typeof btsSettingsSchema>;
export type BtsAuth = { baseUrl: string; login: string; password: string };
export type BtsConfig = BtsSettings & BtsAuth;

export class BtsError extends Error {}

export async function loadBts(db: SupabaseClient, workspaceId: string): Promise<BtsConfig | null> {
  const { data } = await db
    .from("integrations")
    .select("status, settings, credentials_encrypted")
    .eq("workspace_id", workspaceId)
    .eq("provider", "bts")
    .maybeSingle();
  if (!data || data.status === "disabled") return null;
  const s = btsSettingsSchema.safeParse(data.settings);
  if (!s.success) return null;
  try {
    const c = JSON.parse(decryptSecret(data.credentials_encrypted as string)) as { login?: string; password?: string };
    return c.login && c.password ? { ...s.data, login: c.login, password: c.password } : null;
  } catch {
    return null;
  }
}

/** Faqat kirish ma'lumotlari (to'liq sozlanmagan bo'lsa ham — ma'lumotnomalar uchun) */
export async function loadBtsAuth(db: SupabaseClient, workspaceId: string): Promise<BtsAuth | null> {
  const { data } = await db.from("integrations").select("settings, credentials_encrypted").eq("workspace_id", workspaceId).eq("provider", "bts").maybeSingle();
  if (!data) return null;
  try {
    const c = JSON.parse(decryptSecret(data.credentials_encrypted as string)) as { login?: string; password?: string };
    const baseUrl = String((data.settings as { baseUrl?: string } | null)?.baseUrl || BTS_TEST_URL);
    return c.login && c.password ? { baseUrl, login: c.login, password: c.password } : null;
  } catch {
    return null;
  }
}

type Envelope<T> = { status?: boolean; message?: string; data?: T; errors?: Record<string, string[]> };

const tokenCache = new Map<string, { token: string; until: number }>();

async function raw<T>(base: string, method: "GET" | "POST", path: string, token: string | null, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        language: "uz",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new BtsError("BTS serveri bilan aloqa yo'q. Server manzilini tekshiring yoki keyinroq urinib ko'ring.");
  }
  const json = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (res.status === 401) throw new BtsError("BTS login yoki parol noto'g'ri");
  if (!res.ok || json.status === false) {
    const first = json.errors ? Object.values(json.errors).flat()[0] : null;
    throw new BtsError(`BTS: ${first ?? json.message ?? `xato (${res.status})`}`);
  }
  return (json.data ?? ({} as T)) as T;
}

async function token(cfg: BtsAuth, fresh = false): Promise<string> {
  const key = `${cfg.baseUrl}|${cfg.login}`;
  const hit = tokenCache.get(key);
  if (!fresh && hit && hit.until > Date.now()) return hit.token;
  const d = await raw<{ access_token: string }>(cfg.baseUrl, "POST", "/auth/login", null, { login: cfg.login, password: cfg.password });
  if (!d.access_token) throw new BtsError("BTS token bermadi");
  tokenCache.set(key, { token: d.access_token, until: Date.now() + 20 * 3600 * 1000 });
  return d.access_token;
}

async function call<T>(cfg: BtsAuth, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  try {
    return await raw<T>(cfg.baseUrl, method, path, await token(cfg), body);
  } catch (err) {
    // Token eskirgan bo'lsa bir marta qayta kiramiz
    if (err instanceof BtsError && /login yoki parol/.test(err.message)) return raw<T>(cfg.baseUrl, method, path, await token(cfg, true), body);
    throw err;
  }
}

export const testLogin = (cfg: BtsAuth) => token(cfg, true);

export async function regions(cfg: BtsAuth) {
  const d = await call<{ items: { code: string; name: string }[] }>(cfg, "GET", "/v1/directory/regions?per-page=100");
  return d.items ?? [];
}

export async function cities(cfg: BtsAuth, regionCode: string) {
  if (!/^[A-Za-z0-9]{1,10}$/.test(regionCode)) throw new BtsError("Viloyat kodi noto'g'ri");
  const d = await call<{ items: { code: string; name: string; office_exists?: boolean }[] }>(cfg, "GET", `/v1/directory/cities?regionCode=${regionCode}&per-page=200`);
  return d.items ?? [];
}

export type BtsQuote = { courier: number | null; branch: number | null };

export async function calculate(cfg: BtsConfig, receiverCityCode: string, weight: number): Promise<BtsQuote> {
  const d = await call<Record<string, { available?: boolean; price?: number }>>(cfg, "POST", "/v1/order-calculate/index", {
    senderCityCode: cfg.senderCityCode,
    receiverCityCode,
    pickup_type: cfg.pickupType === "self" ? "branch" : "courier",
    dropoff_type: "courier",
    is_multiple_cost: 1,
    weight,
  });
  const from = cfg.pickupType === "self" ? "branch" : "courier";
  const pick = (k: string) => (d[k]?.available !== false && typeof d[k]?.price === "number" ? (d[k].price as number) : null);
  return { courier: pick(`${from}_to_courier`), branch: pick(`${from}_to_branch`) };
}

type OrderLite = {
  id: string;
  workspace_id: string;
  number: number;
  status: OrderStatus;
  customer_name: string | null;
  phone: string;
  address: string | null;
  items: { name: string; qty: number; price: number }[];
  total: number;
  payment_status: string;
  chat_id: number | null;
  bot_project_id: string | null;
  external_ids: Record<string, string> | null;
};
const COLS = "id, workspace_id, number, status, customer_name, phone, address, items, total, payment_status, chat_id, bot_project_id, external_ids";

async function loadOrder(db: SupabaseClient, workspaceId: string, orderId: string): Promise<OrderLite> {
  const { data } = await db.from("orders").select(COLS).eq("id", orderId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new BtsError("Buyurtma topilmadi");
  return data as unknown as OrderLite;
}

async function saveExt(db: SupabaseClient, order: OrderLite, patch: Record<string, string>) {
  const { data } = await db.from("orders").select("external_ids").eq("id", order.id).maybeSingle();
  const ext = { ...((data?.external_ids as Record<string, string> | null) ?? {}), ...patch };
  await db.from("orders").update({ external_ids: ext }).eq("id", order.id);
  order.external_ids = ext;
}

async function cfgOf(db: SupabaseClient, workspaceId: string) {
  const cfg = await loadBts(db, workspaceId);
  if (!cfg) throw new BtsError("BTS ulanmagan. Integratsiyalar → BTS sahifasida ulang.");
  return cfg;
}

export async function btsQuote(db: SupabaseClient, workspaceId: string, receiverCityCode: string, weight?: number) {
  const cfg = await cfgOf(db, workspaceId);
  return calculate(cfg, receiverCityCode, weight ?? cfg.defaultWeight);
}

export async function btsCreate(
  db: SupabaseClient,
  workspaceId: string,
  orderId: string,
  opts: { receiverCityCode: string; dropoff: "courier" | "branch"; weight?: number; cod: boolean },
) {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  if (order.status === "cancelled") throw new BtsError("Bekor qilingan buyurtma");
  const prev = order.external_ids?.bts_status ? Number(order.external_ids.bts_status) : null;
  if (order.external_ids?.bts && prev !== 1300 && prev !== 1400) throw new BtsError("Bu buyurtma BTS'ga allaqachon yuborilgan");
  if (!order.address && opts.dropoff === "courier") throw new BtsError("Mijoz manzili yo'q");

  const phone = normalizeUzPhone(order.phone) ?? order.phone;
  const senderPhone = normalizeUzPhone(cfg.senderPhone) ?? cfg.senderPhone;
  const d = await call<{ orderId: number; barcode?: string; cost?: number; tracking?: string; status?: { code: number | null } }>(cfg, "POST", "/v1/order/add", {
    clientId: `MIXBOT-${order.number}`,
    pickup_type: cfg.pickupType,
    dropoff_type: opts.dropoff,
    is_sender_location: false,
    is_receiver_location: false,
    sender: { name: cfg.senderName, phone: senderPhone.replace(/\s/g, ""), address: cfg.senderAddress, city_code: cfg.senderCityCode },
    receiver: { name: order.customer_name || "Mijoz", phone: phone.replace(/\s/g, ""), address: order.address || "Filialdan olib ketadi", city_code: opts.receiverCityCode },
    ...(opts.cod && order.payment_status !== "paid" ? { bringBackMoney: 1, back_money: Number(order.total) } : {}),
    cargo: {
      weight: opts.weight ?? cfg.defaultWeight,
      piece: 1,
      postTypes: order.items.slice(0, 50).map((i) => ({ name: i.name.slice(0, 100), code: "", count: i.qty, cost: Math.round(i.price) })),
    },
    ready_to_take: true,
  });
  await saveExt(db, order, {
    bts: String(d.orderId),
    bts_barcode: d.barcode ?? "",
    bts_status: String(d.status?.code ?? 100),
    bts_cost: d.cost ? String(d.cost) : "",
    bts_tracking: d.tracking ?? "",
  });
  if (d.tracking || d.barcode) {
    await notifyCustomerText(
      db,
      order,
      `📦 Buyurtma №${order.number} BTS orqali jo'natilmoqda.${d.barcode ? `\nTrek raqami: ${d.barcode}` : ""}${d.tracking ? `\nKuzatish: ${d.tracking}` : ""}`,
    );
  }
  return { btsOrderId: d.orderId, barcode: d.barcode ?? null, cost: d.cost ?? null, tracking: d.tracking ?? null };
}

export async function btsRefresh(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const id = order.external_ids?.bts;
  if (!id) throw new BtsError("Bu buyurtma BTS'ga yuborilmagan");
  const d = await call<{ status?: { code: number; name?: string } }>(cfg, "GET", `/v1/order/track?orderId=${encodeURIComponent(id)}`);
  const code = Number(d.status?.code ?? 0);
  const prev = Number(order.external_ids?.bts_status ?? 0);
  await saveExt(db, order, { bts_status: String(code) });
  if (code !== prev) {
    if (code >= 200 && code < 1200 && (order.status === "new" || order.status === "confirmed")) {
      await db.from("orders").update({ status: "delivering" }).eq("id", order.id);
      await notifyCustomerStatus(db, order, "delivering");
    }
    if (code === 1200 && order.status !== "done" && order.status !== "cancelled") {
      await db.from("orders").update({ status: "done" }).eq("id", order.id);
      await notifyCustomerStatus(db, order, "done");
    }
  }
  return code;
}

export async function btsCancel(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const id = order.external_ids?.bts;
  if (!id) throw new BtsError("Bu buyurtma BTS'ga yuborilmagan");
  await call(cfg, "GET", `/v1/order-cancel/index?orderId=${encodeURIComponent(id)}`);
  await saveExt(db, order, { bts_status: "1300" });
}
