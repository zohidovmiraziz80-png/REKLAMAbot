import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { normalizeUzPhone } from "@/lib/phone";
import type { OrderStatus } from "@/lib/shop/format";
import { notifyCustomerStatus, notifyCustomerText } from "@/lib/shop/notify";
import { FARGO_STATUS, fargoStage } from "./fargo-status";

/**
 * Fargo — viloyatlararo yetkazish (Tezbor Merchant API).
 * Avtorizatsiya: "Authorization: Token <access_token>".
 * Token: POST /api/accounts/v1/login/password {phone_number, password, app_type:1} → access_token.
 * Server manzili (base_url) Fargo menejeri tomonidan beriladi.
 * Oqim: calculate-order → create-order (Draft) → pay-order (64 = merchant VIP) → track-order / customer-order-detail → update-order-status 512 (bekor).
 */

export const fargoSettingsSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .regex(/^https:\/\/[a-z0-9.-]+(:\d{2,5})?\/?$/i, "Server manzili https://... ko'rinishida bo'lishi kerak (faqat domen)"),
  senderName: z.string().trim().min(2, "Jo'natuvchi nomini kiriting").max(80),
  senderPhone: z.string().trim().min(9, "Telefon raqamini kiriting").max(20),
  senderAddress: z.string().trim().min(5, "Jo'natish manzilini kiriting").max(300),
  senderCity: z.string().trim().min(2, "Shaharni tanlang").max(60),
  senderDistrict: z.string().trim().max(80).default(""),
  senderLat: z.number().min(-90).max(90).nullable().default(null),
  senderLon: z.number().min(-180).max(180).nullable().default(null),
  /** Fargo kuryeri uydan olib ketadimi (aks holda filialga o'zingiz topshirasiz) */
  pickupFromDoor: z.boolean().default(true),
  deliveryOption: z.union([z.literal(1), z.literal(2)]).default(1),
  defaultWeight: z.number().min(0.1).max(100).default(1),
});
export type FargoSettings = z.infer<typeof fargoSettingsSchema>;
export type FargoCreds = { phone?: string; password?: string; token?: string };
export type FargoAuth = { baseUrl: string } & FargoCreds;
export type FargoConfig = FargoSettings & FargoAuth;

export class FargoError extends Error {}

function parseCreds(enc: string): FargoCreds {
  try {
    return JSON.parse(decryptSecret(enc)) as FargoCreds;
  } catch {
    return {};
  }
}

export async function loadFargo(db: SupabaseClient, workspaceId: string): Promise<FargoConfig | null> {
  const { data } = await db.from("integrations").select("status, settings, credentials_encrypted").eq("workspace_id", workspaceId).eq("provider", "fargo").maybeSingle();
  if (!data || data.status === "disabled") return null;
  const s = fargoSettingsSchema.safeParse(data.settings);
  if (!s.success) return null;
  const c = parseCreds(data.credentials_encrypted as string);
  return c.token || (c.phone && c.password) ? { ...s.data, ...c } : null;
}

export async function loadFargoAuth(db: SupabaseClient, workspaceId: string): Promise<FargoAuth | null> {
  const { data } = await db.from("integrations").select("settings, credentials_encrypted").eq("workspace_id", workspaceId).eq("provider", "fargo").maybeSingle();
  if (!data) return null;
  const baseUrl = String((data.settings as { baseUrl?: string } | null)?.baseUrl ?? "");
  const c = parseCreds(data.credentials_encrypted as string);
  return baseUrl && (c.token || (c.phone && c.password)) ? { baseUrl, ...c } : null;
}

type Envelope = { success?: boolean; code?: number; message?: string; detail?: string; errors?: unknown } & Record<string, unknown>;

async function raw<T>(base: string, method: "GET" | "POST", path: string, token: string | null, body?: unknown): Promise<T & Envelope> {
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method,
      headers: { "content-type": "application/json", accept: "application/json", ...(token ? { authorization: `Token ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new FargoError("Fargo serveri bilan aloqa yo'q. Server manzilini tekshiring yoki keyinroq urinib ko'ring.");
  }
  const json = (await res.json().catch(() => ({}))) as T & Envelope;
  if (res.status === 401 || res.status === 403) throw new FargoError("Fargo: kirish rad etildi (login, parol yoki token noto'g'ri)");
  if (!res.ok || json.success === false) {
    const m = json.message || json.detail || (json.errors ? JSON.stringify(json.errors).slice(0, 200) : "");
    throw new FargoError(`Fargo: ${m || `xato (${res.status})`}`);
  }
  return json;
}

const tokenCache = new Map<string, { token: string; until: number }>();

async function token(auth: FargoAuth, fresh = false): Promise<string> {
  if (auth.token) return auth.token;
  if (!auth.phone || !auth.password) throw new FargoError("Fargo login va parolini kiriting");
  const key = `${auth.baseUrl}|${auth.phone}`;
  const hit = tokenCache.get(key);
  if (!fresh && hit && hit.until > Date.now()) return hit.token;
  const d = await raw<{ access_token?: string }>(auth.baseUrl, "POST", "/api/accounts/v1/login/password", null, {
    phone_number: normalizeUzPhone(auth.phone) ?? auth.phone,
    password: auth.password,
    app_type: 1,
    device_type: 4,
    device_token: "",
  });
  if (!d.access_token) throw new FargoError("Fargo token bermadi");
  tokenCache.set(key, { token: d.access_token, until: Date.now() + 12 * 3600 * 1000 });
  return d.access_token;
}

async function call<T>(auth: FargoAuth, method: "GET" | "POST", path: string, body?: unknown): Promise<T & Envelope> {
  try {
    return await raw<T>(auth.baseUrl, method, path, await token(auth), body);
  } catch (err) {
    if (!auth.token && err instanceof FargoError && /rad etildi/.test(err.message)) return raw<T>(auth.baseUrl, method, path, await token(auth, true), body);
    throw err;
  }
}

/** Kirishni tekshirish: buyurtmalar ro'yxatidan oxirgisini so'raymiz */
export async function testFargo(auth: FargoAuth) {
  await call(auth, "GET", "/api/orders/v1/customer-order-list/?last=true&page_size=1");
}

type Named = { id: number; name?: string; region_name?: string };

export async function fargoCities(auth: FargoAuth): Promise<string[]> {
  const d = await call<{ results?: Named[] }>(auth, "GET", "/api/addresses/v1/city-list/");
  return (d.results ?? []).map((c) => c.name ?? "").filter(Boolean);
}

export async function fargoDistricts(auth: FargoAuth, city: string): Promise<string[]> {
  if (!city || city.length > 60) throw new FargoError("Shahar noto'g'ri");
  const d = await call<{ results?: Named[] }>(auth, "GET", `/api/addresses/v1/get-district/${encodeURIComponent(city)}`);
  return (d.results ?? []).map((c) => c.region_name ?? c.name ?? "").filter(Boolean);
}

export type FargoDest = { city: string; district: string; toDoor: boolean; weight?: number; cod: boolean };

function services(cfg: FargoConfig, toDoor: boolean) {
  return [...(cfg.pickupFromDoor ? [1] : []), ...(toDoor ? [2] : [])];
}

function amountOf(d: Record<string, unknown>): number | null {
  const r = (d.results ?? d.data ?? d) as Record<string, unknown>;
  for (const k of ["amount", "price", "total", "total_price", "delivery_price"]) {
    const v = Number(r?.[k]);
    if (Number.isFinite(v) && v > 0) return Math.round(v);
  }
  return null;
}

type OrderLite = {
  id: string;
  workspace_id: string;
  number: number;
  status: OrderStatus;
  customer_name: string | null;
  phone: string;
  address: string | null;
  comment: string | null;
  items: { name: string; qty: number; price: number }[];
  total: number;
  payment_status: string;
  chat_id: number | null;
  bot_project_id: string | null;
  external_ids: Record<string, string> | null;
};
const COLS = "id, workspace_id, number, status, customer_name, phone, address, comment, items, total, payment_status, chat_id, bot_project_id, external_ids";

async function loadOrder(db: SupabaseClient, workspaceId: string, orderId: string): Promise<OrderLite> {
  const { data } = await db.from("orders").select(COLS).eq("id", orderId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new FargoError("Buyurtma topilmadi");
  return data as unknown as OrderLite;
}

async function saveExt(db: SupabaseClient, order: OrderLite, patch: Record<string, string>) {
  const { data } = await db.from("orders").select("external_ids").eq("id", order.id).maybeSingle();
  const ext = { ...((data?.external_ids as Record<string, string> | null) ?? {}), ...patch };
  await db.from("orders").update({ external_ids: ext }).eq("id", order.id);
  order.external_ids = ext;
}

async function cfgOf(db: SupabaseClient, workspaceId: string) {
  const cfg = await loadFargo(db, workspaceId);
  if (!cfg) throw new FargoError("Fargo ulanmagan. Integratsiyalar → Fargo sahifasida ulang.");
  return cfg;
}

const parcel = (w: number) => ({ weight: w, width: 20, height: 10, length: 30 });

export async function fargoQuote(db: SupabaseClient, workspaceId: string, dest: Omit<FargoDest, "cod"> & { productFee?: number }) {
  const cfg = await cfgOf(db, workspaceId);
  const d = await call<Record<string, unknown>>(cfg, "POST", "/api/orders/v1/calculate-order", {
    from: { city: cfg.senderCity, district: cfg.senderDistrict || undefined },
    to: { city: dest.city, district: dest.district || undefined },
    parcel_size: parcel(dest.weight ?? cfg.defaultWeight),
    boxes_count: 1,
    delivery_option: cfg.deliveryOption,
    product_fee: dest.productFee ?? 0,
    services: services(cfg, dest.toDoor),
  });
  return { price: amountOf(d) };
}

export async function fargoCreate(db: SupabaseClient, workspaceId: string, orderId: string, dest: FargoDest) {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  if (order.status === "cancelled") throw new FargoError("Bekor qilingan buyurtma");
  const prev = Number(order.external_ids?.fargo_status ?? 0);
  if (order.external_ids?.fargo && !(prev & (FARGO_STATUS.CANCELLED_BY_CUSTOMER | FARGO_STATUS.CANCELLED_BY_EXECUTOR | FARGO_STATUS.RETURNED)))
    throw new FargoError("Bu buyurtma Fargo'ga allaqachon yuborilgan");
  if (dest.toDoor && !order.address) throw new FargoError("Mijoz manzili yo'q — «Filialdan oladi» ni tanlang");

  const geo = order.external_ids?.geo?.split(",").map(Number);
  const hasGeo = !!geo && geo.length === 2 && geo.every(Number.isFinite);
  const cod = dest.cod && order.payment_status !== "paid";
  const created = await call<{ results?: { id?: number; order_track_id?: string; amount?: number; status?: number } }>(cfg, "POST", "/api/orders/v1/create-order", {
    reference_id: `MIXBOT-${order.number}`,
    receiver_name: order.customer_name || "Mijoz",
    receiver_phone: normalizeUzPhone(order.phone) ?? order.phone.replace(/\s/g, ""),
    sender_name: cfg.senderName,
    sender_phone: normalizeUzPhone(cfg.senderPhone) ?? cfg.senderPhone.replace(/\s/g, ""),
    description: order.items
      .slice(0, 20)
      .map((i) => `${i.name} × ${i.qty}`)
      .join(", ")
      .slice(0, 500),
    from: {
      address1: cfg.senderAddress,
      address2: "",
      city: cfg.senderCity,
      district: cfg.senderDistrict,
      ...(cfg.senderLat != null && cfg.senderLon != null ? { latitude: cfg.senderLat, longitude: cfg.senderLon } : {}),
    },
    to: {
      address1: order.address || "Filialdan olib ketadi",
      address2: order.comment?.slice(0, 200) ?? "",
      city: dest.city,
      district: dest.district,
      ...(hasGeo ? { latitude: geo![0], longitude: geo![1] } : {}),
    },
    parcel_size: parcel(dest.weight ?? cfg.defaultWeight),
    boxes_count: 1,
    product_fee: cod ? Math.round(Number(order.total)) : 0,
    delivery_option: cfg.deliveryOption,
    images: [],
    services: services(cfg, dest.toDoor),
  });
  const r = created.results ?? {};
  if (!r.id) throw new FargoError("Fargo buyurtma raqamini qaytarmadi");
  // Draft → New: merchant to'lovi (oy oxirida hisob-kitob)
  await call(cfg, "POST", "/api/billing/v1/pay-order", { id: r.id, payment_status: 64 });
  await saveExt(db, order, {
    fargo: String(r.id),
    fargo_track: r.order_track_id ?? "",
    fargo_status: String(cfg.pickupFromDoor ? FARGO_STATUS.NEW : FARGO_STATUS.EXPECTED),
    fargo_price: r.amount ? String(Math.round(Number(r.amount))) : "",
  });
  if (r.order_track_id) {
    await notifyCustomerText(db, order, `📦 Buyurtma №${order.number} Fargo orqali jo'natilmoqda.\nTrek raqami: ${r.order_track_id}`);
  }
  return { fargoId: r.id, track: r.order_track_id ?? null, price: r.amount ? Math.round(Number(r.amount)) : null };
}

function latestStatus(d: Record<string, unknown>): number | null {
  const r = (d.results ?? d.order ?? d) as unknown;
  if (r && !Array.isArray(r) && typeof r === "object" && Number.isFinite(Number((r as { status?: unknown }).status))) return Number((r as { status: unknown }).status);
  const logs = (Array.isArray(r) ? r : Array.isArray(d.results) ? d.results : []) as { status?: number; created_at?: string }[];
  const last = [...logs].filter((l) => Number.isFinite(Number(l.status))).sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
  return last ? Number(last.status) : null;
}

export async function fargoRefresh(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const id = order.external_ids?.fargo;
  if (!id) throw new FargoError("Bu buyurtma Fargo'ga yuborilmagan");
  let code: number | null = null;
  try {
    code = latestStatus(await call<Record<string, unknown>>(cfg, "GET", `/api/orders/v1/customer-order-detail/${encodeURIComponent(id)}/`));
  } catch {
    code = null;
  }
  if (code == null && order.external_ids?.fargo_track) {
    code = latestStatus(await call<Record<string, unknown>>(cfg, "GET", `/api/orders/v1/track-order/${encodeURIComponent(order.external_ids.fargo_track)}/`));
  }
  if (code == null) throw new FargoError("Fargo holatni qaytarmadi");
  const prev = Number(order.external_ids?.fargo_status ?? 0);
  await saveExt(db, order, { fargo_status: String(code) });
  if (code !== prev) {
    const stage = fargoStage(code);
    if (stage === "moving" && (order.status === "new" || order.status === "confirmed")) {
      await db.from("orders").update({ status: "delivering" }).eq("id", order.id);
      await notifyCustomerStatus(db, order, "delivering");
    }
    if (stage === "done" && order.status !== "done" && order.status !== "cancelled") {
      await db.from("orders").update({ status: "done" }).eq("id", order.id);
      await notifyCustomerStatus(db, order, "done");
    }
  }
  return code;
}

export async function fargoCancel(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const id = order.external_ids?.fargo;
  if (!id) throw new FargoError("Bu buyurtma Fargo'ga yuborilmagan");
  await call(cfg, "POST", "/api/orders/v1/update-order-status", { id: Number(id), status: FARGO_STATUS.CANCELLED_BY_CUSTOMER });
  await saveExt(db, order, { fargo_status: String(FARGO_STATUS.CANCELLED_BY_CUSTOMER) });
}
