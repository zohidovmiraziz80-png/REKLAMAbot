import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
export { YANDEX_STATUS_UZ } from "./yandex-status";

/**
 * Yandex Delivery (Express) API: https://b2b.taxi.yandex.net/b2b/cargo/integration/v2
 * Avtorizatsiya: Authorization: Bearer <OAuth token> (dostavka.yandex.ru → Integratsiya → Tokenni olish).
 * Koordinatalar tartibi: [uzunlik (lon), kenglik (lat)].
 */

const BASE = "https://b2b.taxi.yandex.net/b2b/cargo/integration/v2";

export const yandexSettingsSchema = z.object({
  pickupAddress: z.string().trim().min(5, "Olib ketish manzilini kiriting").max(300),
  pickupLat: z.number().min(-90).max(90),
  pickupLon: z.number().min(-180).max(180),
  pickupComment: z.string().trim().max(500).default(""),
  contactName: z.string().trim().min(2, "Mas'ul shaxs ismini kiriting").max(80),
  contactPhone: z.string().trim().min(9, "Telefon raqamini kiriting").max(30),
  contactEmail: z.string().trim().email("Email noto'g'ri").max(120),
  taxiClass: z.enum(["courier", "express"]).default("courier"),
});
export type YandexSettings = z.infer<typeof yandexSettingsSchema>;
export type YandexConfig = YandexSettings & { token: string };

export async function loadYandex(db: SupabaseClient, workspaceId: string): Promise<YandexConfig | null> {
  const { data } = await db
    .from("integrations")
    .select("status, settings, credentials_encrypted")
    .eq("workspace_id", workspaceId)
    .eq("provider", "yandex")
    .maybeSingle();
  if (!data || data.status === "disabled") return null;
  const s = yandexSettingsSchema.safeParse(data.settings);
  if (!s.success) return null;
  try {
    const creds = JSON.parse(decryptSecret(data.credentials_encrypted as string)) as { token?: string };
    return creds.token ? { ...s.data, token: creds.token } : null;
  } catch {
    return null;
  }
}

export class YandexError extends Error {}

const ERROR_UZ: Record<string, string> = {
  address_not_found: "Manzil topilmadi",
  "estimating.route_too_long": "Masofa juda uzoq",
  "estimating.requirement_unavailable": "Bu hududda tanlangan tarif mavjud emas",
  unauthorized: "Token noto'g'ri yoki eskirgan",
  too_many_requests: "Juda ko'p so'rov, birozdan keyin urinib ko'ring",
};

async function call<T>(token: string, method: "GET" | "POST", path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "accept-language": "ru" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new YandexError("Yandex Delivery bilan aloqa yo'q. Keyinroq urinib ko'ring.");
  }
  const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string } & Record<string, unknown>;
  if (res.status === 401 || res.status === 403) throw new YandexError(ERROR_UZ.unauthorized);
  if (!res.ok) {
    const code = String(json.code ?? "");
    throw new YandexError(ERROR_UZ[code] ?? (json.message ? `Yandex: ${json.message}` : `Yandex xatosi (${res.status})`));
  }
  return json as T;
}

export type Point = { lat: number; lon: number; fullname: string };

export async function checkPrice(cfg: YandexConfig, dest: Point) {
  const r = await call<{ price: string; currency_rules?: { code?: string }; eta?: number; distance_meters?: number }>(cfg.token, "POST", "check-price", {
    items: [{ quantity: 1, weight: 1, size: { length: 0.3, width: 0.3, height: 0.2 } }],
    route_points: [
      { id: 1, coordinates: [cfg.pickupLon, cfg.pickupLat], fullname: cfg.pickupAddress },
      { id: 2, coordinates: [dest.lon, dest.lat], fullname: dest.fullname },
    ],
    requirements: { taxi_class: cfg.taxiClass },
  });
  return {
    price: Math.round(Number(r.price)),
    currency: r.currency_rules?.code ?? "UZS",
    etaMinutes: r.eta ?? null,
    distanceKm: r.distance_meters ? Math.round(r.distance_meters / 100) / 10 : null,
  };
}

export type ClaimOrder = {
  id: string;
  number: number;
  customer_name: string | null;
  phone: string;
  address: string | null;
  comment: string | null;
  items: { name: string; qty: number; price: number }[];
};

export async function createClaim(cfg: YandexConfig, order: ClaimOrder, dest: Point, callbackUrl: string) {
  const r = await call<{ id: string; status: string; version: number }>(
    cfg.token,
    "POST",
    "claims/create",
    {
      items: order.items.slice(0, 50).map((i) => ({
        title: i.name.slice(0, 200),
        cost_value: Number(i.price).toFixed(2),
        cost_currency: "UZS",
        quantity: Math.max(1, i.qty),
        pickup_point: 1,
        droppof_point: 2,
        weight: 1,
        size: { length: 0.3, width: 0.3, height: 0.2 },
      })),
      route_points: [
        {
          point_id: 1,
          visit_order: 1,
          type: "source",
          contact: { name: cfg.contactName, phone: cfg.contactPhone, email: cfg.contactEmail },
          address: { fullname: cfg.pickupAddress, coordinates: [cfg.pickupLon, cfg.pickupLat], comment: cfg.pickupComment || undefined },
          skip_confirmation: true,
        },
        {
          point_id: 2,
          visit_order: 2,
          type: "destination",
          contact: { name: order.customer_name || "Mijoz", phone: order.phone },
          address: { fullname: dest.fullname, coordinates: [dest.lon, dest.lat], comment: [order.address, order.comment].filter(Boolean).join(". ").slice(0, 1000) || undefined },
          external_order_id: `MIXBOT-${order.number}`,
          skip_confirmation: true,
        },
      ],
      client_requirements: { taxi_class: cfg.taxiClass },
      emergency_contact: { name: cfg.contactName, phone: cfg.contactPhone },
      callback_properties: { callback_url: callbackUrl },
      comment: `Buyurtma №${order.number}`,
    },
    { request_id: `mixbot-${order.id}-${Date.now()}` },
  );
  return r;
}

export type ClaimInfo = {
  id: string;
  status: string;
  version: number;
  pricing?: { offer?: { price?: string }; final_price?: string };
  performer_info?: { courier_name?: string; car_model?: string; car_number?: string; legal_name?: string };
};

export const claimInfo = (cfg: YandexConfig, claimId: string) => call<ClaimInfo>(cfg.token, "POST", "claims/info", undefined, { claim_id: claimId });

export const acceptClaim = (cfg: YandexConfig, claimId: string, version: number) =>
  call<{ id: string; status: string }>(cfg.token, "POST", "claims/accept", { version }, { claim_id: claimId });

export async function cancelClaim(cfg: YandexConfig, claimId: string) {
  const info = await claimInfo(cfg, claimId);
  const ci = await call<{ cancel_state: "free" | "paid" | "unavailable" }>(cfg.token, "POST", "claims/cancel-info", undefined, { claim_id: claimId });
  if (ci.cancel_state === "unavailable") throw new YandexError("Bu bosqichda bekor qilib bo'lmaydi — Yandex qo'llab-quvvatlashiga murojaat qiling");
  await call(cfg.token, "POST", "claims/cancel", { cancel_state: ci.cancel_state, version: info.version }, { claim_id: claimId });
  return ci.cancel_state;
}

/** Manzilni koordinataga aylantirish (OpenStreetMap Nominatim, O'zbekiston bo'yicha) */
export async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const q = new URL("https://nominatim.openstreetmap.org/search");
  q.searchParams.set("format", "json");
  q.searchParams.set("countrycodes", "uz");
  q.searchParams.set("limit", "1");
  q.searchParams.set("q", address);
  try {
    const res = await fetch(q, { headers: { "user-agent": "MIXBOT/1.0 (delivery)" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    const arr = (await res.json()) as { lat: string; lon: string }[];
    if (!arr?.[0]) return null;
    return { lat: Number(arr[0].lat), lon: Number(arr[0].lon) };
  } catch {
    return null;
  }
}

export const YANDEX_FINAL = new Set([
  "delivered_finish",
  "returned_finish",
  "cancelled",
  "cancelled_with_payment",
  "cancelled_by_taxi",
  "cancelled_with_items_on_hands",
  "failed",
  "estimating_failed",
  "performer_not_found",
]);
