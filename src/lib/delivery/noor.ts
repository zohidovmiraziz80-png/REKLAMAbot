import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { normalizeUzPhone } from "@/lib/phone";
import { formatMoney, type OrderStatus } from "@/lib/shop/format";
import { notifyCustomerStatus, notifyCustomerText } from "@/lib/shop/notify";
import { geocode } from "./yandex";
import { NOOR_STAGE_UZ } from "./noor-status";
export { NOOR_STAGE_UZ };

/**
 * Noor Delivery API v1 (https://developer.help.noor.uz).
 * Avtorizatsiya: har so'rovda "X-Auth: <token>" (token Noor menejeri beradi).
 * Server: ishchi https://back.noor.uz, sinov https://tback.noor.uz. Barcha vaqtlar UTC.
 * Oqim: POST /orders/eval (narx) → POST /orders (yaratish) → GET /orders/{id} (holat) → PATCH /orders/{id}/cancel.
 */

const BASES = { prod: "https://back.noor.uz", test: "https://tback.noor.uz" } as const;

export const noorSettingsSchema = z.object({
  env: z.enum(["prod", "test"]).default("prod"),
  pickupAddress: z.string().trim().min(5, "Olib ketish manzilini kiriting").max(300),
  pickupLat: z.number().min(-90).max(90),
  pickupLon: z.number().min(-180).max(180),
  pickupComment: z.string().trim().max(500).default(""),
  contactName: z.string().trim().min(2, "Mas'ul shaxs ismini kiriting").max(80),
  contactPhone: z.string().trim().min(9, "Telefon raqamini kiriting").max(30),
  /** Yetkazish haqini kim to'laydi: BALANCE — do'kon balansidan, CARD — do'kon kartasidan, CASH — mijoz naqd */
  paymentType: z.enum(["BALANCE", "CARD", "CASH"]).default("BALANCE"),
  doorToDoor: z.boolean().default(false),
});
export type NoorSettings = z.infer<typeof noorSettingsSchema>;
export type NoorConfig = NoorSettings & { token: string };

export class NoorError extends Error {}

export async function loadNoor(db: SupabaseClient, workspaceId: string): Promise<NoorConfig | null> {
  const { data } = await db.from("integrations").select("status, settings, credentials_encrypted").eq("workspace_id", workspaceId).eq("provider", "noor").maybeSingle();
  if (!data || data.status === "disabled") return null;
  const s = noorSettingsSchema.safeParse(data.settings);
  if (!s.success) return null;
  try {
    const c = JSON.parse(decryptSecret(data.credentials_encrypted as string)) as { token?: string };
    return c.token ? { ...s.data, token: c.token } : null;
  } catch {
    return null;
  }
}

async function call<T>(cfg: { env: "prod" | "test"; token: string }, method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASES[cfg.env]}/api/v1${path}`, {
      method,
      headers: { "x-auth": cfg.token, "content-type": "application/json", accept: "application/json", "accept-language": "uz" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new NoorError("Noor serveri bilan aloqa yo'q. Keyinroq urinib ko'ring.");
  }
  if (res.status === 204) return {} as T;
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) throw new NoorError("Noor tokeni noto'g'ri yoki eskirgan");
  if (!res.ok) {
    const m = json.message ?? json.error ?? json.detail;
    const text = Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : typeof m === "object" && m ? JSON.stringify(m).slice(0, 200) : `xato (${res.status})`;
    throw new NoorError(`Noor: ${text}`);
  }
  return json as T;
}

/** Tokenni tekshirish: buyurtmalar ro'yxatidan bittasini so'raymiz */
export async function testNoor(env: "prod" | "test", token: string) {
  await call({ env, token }, "GET", "/orders?limit=1");
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
  delivery_method: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  payment_status: string;
  chat_id: number | null;
  bot_project_id: string | null;
  external_ids: Record<string, string> | null;
};
const COLS = "id, workspace_id, number, status, customer_name, phone, address, comment, delivery_method, items, total, payment_status, chat_id, bot_project_id, external_ids";

async function loadOrder(db: SupabaseClient, workspaceId: string, orderId: string): Promise<OrderLite> {
  const { data } = await db.from("orders").select(COLS).eq("id", orderId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new NoorError("Buyurtma topilmadi");
  return data as unknown as OrderLite;
}

async function saveExt(db: SupabaseClient, order: OrderLite, patch: Record<string, string>) {
  const { data } = await db.from("orders").select("external_ids").eq("id", order.id).maybeSingle();
  const ext = { ...((data?.external_ids as Record<string, string> | null) ?? {}), ...patch };
  await db.from("orders").update({ external_ids: ext }).eq("id", order.id);
  order.external_ids = ext;
}

async function cfgOf(db: SupabaseClient, workspaceId: string) {
  const cfg = await loadNoor(db, workspaceId);
  if (!cfg) throw new NoorError("Noor ulanmagan. Integratsiyalar → Noor sahifasida ulang.");
  return cfg;
}

async function destination(db: SupabaseClient, order: OrderLite) {
  if (order.delivery_method !== "courier" || !order.address) throw new NoorError("Bu buyurtmada yetkazish manzili yo'q");
  const geo = order.external_ids?.geo;
  if (geo) {
    const [lat, lon] = geo.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const found = (await geocode(`${order.address}, Uzbekistan`)) ?? (await geocode(order.address));
  if (!found) throw new NoorError("Manzilni xaritadan topib bo'lmadi. Mijozdan aniqroq manzil so'rang.");
  await saveExt(db, order, { geo: `${found.lat.toFixed(6)},${found.lon.toFixed(6)}`, geo_src: "address" });
  return found;
}

const phoneOf = (p: string) => normalizeUzPhone(p) ?? p.replace(/\s/g, "");

function body(cfg: NoorConfig, order: OrderLite, dest: { lat: number; lon: number }, cod: boolean) {
  return {
    vendor_order_id: `MIXBOT-${order.number}`,
    payment_type: cfg.paymentType,
    is_integration: true,
    delivery: { door_to_door: cfg.doorToDoor, product_paid: !cod, send_link: true },
    origin: [
      {
        address: cfg.pickupAddress,
        location: { lat: cfg.pickupLat, long: cfg.pickupLon },
        client: { name: cfg.contactName, phone: phoneOf(cfg.contactPhone) },
        comment: cfg.pickupComment || undefined,
      },
    ],
    destination: [
      {
        address: order.address,
        location: { lat: dest.lat, long: dest.lon },
        client: { name: order.customer_name || "Mijoz", phone: phoneOf(order.phone) },
        comment: [order.comment, `Buyurtma №${order.number}`].filter(Boolean).join(". ").slice(0, 500),
        products: [
          {
            description: `Buyurtma №${order.number}`,
            items: order.items.slice(0, 50).map((i) => ({ name: i.name.slice(0, 200), quantity: Math.max(1, i.qty), price_per_unit: Math.round(i.price) })),
          },
        ],
      },
    ],
  };
}

export type NoorQuote = { price: number; distanceKm: number | null; eta: string | null; outOfZone: boolean };

export async function noorEstimate(db: SupabaseClient, workspaceId: string, orderId: string, cod: boolean): Promise<NoorQuote> {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const dest = await destination(db, order);
  const r = await call<{ total_delivery_price?: number; order_distance?: number; eta_to_del?: string | null; out_of_zone_points?: number[] }>(
    cfg,
    "POST",
    "/orders/eval",
    body(cfg, order, dest, cod),
  );
  return {
    price: Math.round(Number(r.total_delivery_price ?? 0)),
    distanceKm: r.order_distance != null ? Math.round(Number(r.order_distance) / 100) / 10 : null,
    eta: r.eta_to_del ?? null,
    outOfZone: (r.out_of_zone_points ?? []).length > 0,
  };
}

type NoorOrder = { id: number; display_id?: number; stage?: number; link?: string | null; pricing?: { total?: number } | null; courier?: { name?: string; phone?: string } | null };

export async function noorCreate(db: SupabaseClient, workspaceId: string, orderId: string, cod: boolean) {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  if (order.status === "cancelled") throw new NoorError("Bekor qilingan buyurtma");
  const prev = Number(order.external_ids?.noor_stage ?? 0);
  if (order.external_ids?.noor && prev < 21) throw new NoorError("Bu buyurtma Noor'ga allaqachon yuborilgan");
  const dest = await destination(db, order);
  const r = await call<NoorOrder>(cfg, "POST", "/orders", body(cfg, order, dest, cod && order.payment_status !== "paid"));
  const price = r.pricing?.total != null ? String(Math.round(Number(r.pricing.total))) : "";
  await saveExt(db, order, {
    noor: String(r.id),
    noor_display: r.display_id ? String(r.display_id) : "",
    noor_stage: String(r.stage ?? 1),
    noor_price: price,
    noor_link: r.link ?? "",
  });
  await notifyCustomerText(db, order, `🛵 Buyurtma №${order.number} uchun Noor kuryeri chaqirildi.${r.link ? `\nKuzatish: ${r.link}` : ""}`);
  return { noorId: r.id, display: r.display_id ?? null, stage: r.stage ?? 1, price: price ? Number(price) : null, link: r.link ?? null };
}

export async function noorRefresh(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const id = order.external_ids?.noor;
  if (!id) throw new NoorError("Bu buyurtma Noor'ga yuborilmagan");
  const r = await call<NoorOrder>(cfg, "GET", `/orders/${encodeURIComponent(id)}`);
  const stage = Number(r.stage ?? 0);
  const prev = Number(order.external_ids?.noor_stage ?? 0);
  await saveExt(db, order, {
    noor_stage: String(stage),
    ...(r.link ? { noor_link: r.link } : {}),
    ...(r.courier?.name ? { noor_courier: [r.courier.name, r.courier.phone].filter(Boolean).join(", ") } : {}),
    ...(r.pricing?.total != null ? { noor_price: String(Math.round(Number(r.pricing.total))) } : {}),
  });
  if (stage !== prev) {
    if (stage >= 7 && stage <= 13 && (order.status === "new" || order.status === "confirmed")) {
      await db.from("orders").update({ status: "delivering" }).eq("id", order.id);
      await notifyCustomerStatus(db, order, "delivering");
    }
    if ((stage === 14 || stage === 15) && order.status !== "done" && order.status !== "cancelled") {
      await db.from("orders").update({ status: "done" }).eq("id", order.id);
      await notifyCustomerStatus(db, order, "done");
    }
  }
  return { stage, label: NOOR_STAGE_UZ[stage] ?? String(stage), courier: order.external_ids?.noor_courier ?? null };
}

export async function noorCancel(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([cfgOf(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const id = order.external_ids?.noor;
  if (!id) throw new NoorError("Bu buyurtma Noor'ga yuborilmagan");
  await call(cfg, "PATCH", `/orders/${encodeURIComponent(id)}/cancel`, { id: Number(id), reason: "Do'kon bekor qildi", reorder: false, cancel_transactions: true });
  await saveExt(db, order, { noor_stage: "22" });
}

export const noorPriceText = (q: NoorQuote) => `${formatMoney(q.price)}${q.distanceKm ? ` · ${q.distanceKm} km` : ""}`;
