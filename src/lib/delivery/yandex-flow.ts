import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoney, type OrderStatus } from "@/lib/shop/format";
import { notifyCustomerStatus, notifyCustomerText } from "@/lib/shop/notify";
import { getSiteUrl } from "@/lib/supabase/env";
import {
  YANDEX_FINAL,
  YANDEX_STATUS_UZ,
  YandexError,
  acceptClaim,
  cancelClaim,
  checkPrice,
  claimInfo,
  createClaim,
  geocode,
  loadYandex,
  type ClaimInfo,
  type Point,
  type YandexConfig,
} from "./yandex";

/**
 * Buyurtma uchun Yandex kuryer: narx → chaqirish → holatni kuzatish → bekor qilish.
 * Ma'lumot orders.external_ids ichida: geo ("lat,lon"), yandex (claim id), yandex_status, yandex_price, yandex_courier.
 */

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
  chat_id: number | null;
  bot_project_id: string | null;
  external_ids: Record<string, string> | null;
};

const COLS = "id, workspace_id, number, status, customer_name, phone, address, comment, delivery_method, items, chat_id, bot_project_id, external_ids";

async function loadOrder(db: SupabaseClient, workspaceId: string, orderId: string): Promise<OrderLite> {
  const { data } = await db.from("orders").select(COLS).eq("id", orderId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new YandexError("Buyurtma topilmadi");
  return data as unknown as OrderLite;
}

async function config(db: SupabaseClient, workspaceId: string): Promise<YandexConfig> {
  const cfg = await loadYandex(db, workspaceId);
  if (!cfg) throw new YandexError("Yandex Delivery ulanmagan. Integratsiyalar → Yandex Delivery sahifasida ulang.");
  return cfg;
}

async function saveExt(db: SupabaseClient, order: OrderLite, patch: Record<string, string>) {
  // Boshqa integratsiya (Bito) yozgan qiymatlarni yo'qotmaslik uchun yangidan o'qiymiz
  const { data } = await db.from("orders").select("external_ids").eq("id", order.id).maybeSingle();
  const ext = { ...((data?.external_ids as Record<string, string> | null) ?? {}), ...patch };
  await db.from("orders").update({ external_ids: ext }).eq("id", order.id);
  order.external_ids = ext;
}

/** Mijoz manzili koordinatalari: checkout'dagi joylashuv yoki manzil matnidan */
async function destination(db: SupabaseClient, order: OrderLite): Promise<Point & { approximate: boolean }> {
  if (order.delivery_method !== "courier" || !order.address) throw new YandexError("Bu buyurtmada yetkazish manzili yo'q");
  const geo = order.external_ids?.geo;
  if (geo) {
    const [lat, lon] = geo.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, fullname: order.address, approximate: false };
  }
  const found = (await geocode(`${order.address}, Uzbekistan`)) ?? (await geocode(order.address));
  if (!found) throw new YandexError("Manzilni xaritadan topib bo'lmadi. Mijozdan aniqroq manzil (shahar, ko'cha, uy) so'rang.");
  await saveExt(db, order, { geo: `${found.lat.toFixed(6)},${found.lon.toFixed(6)}`, geo_src: "address" });
  return { ...found, fullname: order.address, approximate: true };
}

export async function estimateYandex(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([config(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const dest = await destination(db, order);
  const r = await checkPrice(cfg, dest);
  return { ...r, approximate: dest.approximate || order.external_ids?.geo_src === "address" };
}

export async function dispatchYandex(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([config(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  if (order.status === "cancelled") throw new YandexError("Bekor qilingan buyurtma");
  const current = order.external_ids?.yandex;
  if (current && order.external_ids?.yandex_status && !YANDEX_FINAL.has(order.external_ids.yandex_status)) {
    throw new YandexError("Bu buyurtmaga kuryer allaqachon chaqirilgan");
  }
  const dest = await destination(db, order);
  // Yandex bu manzilga o'z parametrlarini (claim_id, updated_ts) qo'shib yuboradi
  const callbackUrl = `${getSiteUrl()}/api/delivery/yandex/${workspaceId}?order=${order.id}&`;
  const created = await createClaim(cfg, order, dest, callbackUrl);
  await saveExt(db, order, { yandex: created.id, yandex_status: created.status });

  // Narx hisoblanishini kutamiz (odatda 1–5 soniya), keyin tasdiqlaymiz
  let info: ClaimInfo | null = null;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    info = await claimInfo(cfg, created.id);
    if (info.status !== "new" && info.status !== "estimating") break;
  }
  if (!info || info.status !== "ready_for_approval") {
    if (info) await applyClaimInfo(db, order, info);
    throw new YandexError(
      info?.status === "estimating_failed"
        ? "Yandex bu manzilga yetkazish narxini hisoblay olmadi"
        : "Yandex hali javob bermadi — birozdan keyin «Yangilash» ni bosing",
    );
  }
  await acceptClaim(cfg, created.id, info.version);
  const after = await claimInfo(cfg, created.id);
  await applyClaimInfo(db, order, after);
  return { claimId: created.id, status: after.status, price: priceOf(after) };
}

function priceOf(info: ClaimInfo): number | null {
  const p = info.pricing?.final_price ?? info.pricing?.offer?.price;
  return p ? Math.round(Number(p)) : null;
}

/** Yandex holatini buyurtmaga yozadi; muhim bosqichlarda mijozga xabar */
export async function applyClaimInfo(db: SupabaseClient, order: OrderLite, info: ClaimInfo) {
  const prev = order.external_ids?.yandex_status;
  const perf = info.performer_info;
  const courier = perf?.courier_name ? [perf.courier_name, perf.car_model, perf.car_number].filter(Boolean).join(", ") : "";
  const price = priceOf(info);
  await saveExt(db, order, {
    yandex_status: info.status,
    ...(price ? { yandex_price: String(price) } : {}),
    ...(courier ? { yandex_courier: courier } : {}),
  });
  if (prev === info.status) return;

  if (info.status === "performer_found" && courier) {
    await notifyCustomerText(db, order, `🚕 Buyurtma №${order.number}: kuryer topildi — ${courier}.`);
  }
  if ((info.status === "pickuped" || info.status === "delivery_arrived") && (order.status === "new" || order.status === "confirmed")) {
    await db.from("orders").update({ status: "delivering" }).eq("id", order.id);
    order.status = "delivering";
    await notifyCustomerStatus(db, order, "delivering");
  }
  if ((info.status === "delivered" || info.status === "delivered_finish") && order.status !== "done" && order.status !== "cancelled") {
    await db.from("orders").update({ status: "done" }).eq("id", order.id);
    order.status = "done";
    await notifyCustomerStatus(db, order, "done");
  }
}

export async function refreshYandex(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([config(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const claimId = order.external_ids?.yandex;
  if (!claimId) throw new YandexError("Bu buyurtmaga kuryer chaqirilmagan");
  const info = await claimInfo(cfg, claimId);
  // Narx tayyor bo'lib, tasdiqlanmay qolgan bo'lsa — tasdiqlaymiz
  if (info.status === "ready_for_approval") {
    await acceptClaim(cfg, claimId, info.version);
    const after = await claimInfo(cfg, claimId);
    await applyClaimInfo(db, order, after);
    return after.status;
  }
  await applyClaimInfo(db, order, info);
  return info.status;
}

/** Yandex callback'i: claim id bo'yicha buyurtmani topib yangilaydi */
export async function refreshByClaim(db: SupabaseClient, workspaceId: string, claimId: string) {
  const { data } = await db.from("orders").select(COLS).eq("workspace_id", workspaceId).eq("external_ids->>yandex", claimId).maybeSingle();
  if (!data) return;
  const cfg = await loadYandex(db, workspaceId);
  if (!cfg) return;
  await applyClaimInfo(db, data as unknown as OrderLite, await claimInfo(cfg, claimId));
}

export async function cancelYandex(db: SupabaseClient, workspaceId: string, orderId: string) {
  const [cfg, order] = await Promise.all([config(db, workspaceId), loadOrder(db, workspaceId, orderId)]);
  const claimId = order.external_ids?.yandex;
  if (!claimId) throw new YandexError("Bu buyurtmaga kuryer chaqirilmagan");
  const state = await cancelClaim(cfg, claimId);
  await applyClaimInfo(db, order, await claimInfo(cfg, claimId));
  return state === "paid" ? "Bekor qilindi (kuryer yetib kelgani uchun to'lov olinadi)" : "Bekor qilindi (bepul)";
}

export function yandexSummary(ext: Record<string, string> | null | undefined) {
  if (!ext?.yandex) return null;
  const st = ext.yandex_status ?? "new";
  return {
    claimId: ext.yandex,
    status: st,
    label: YANDEX_STATUS_UZ[st] ?? st,
    final: YANDEX_FINAL.has(st),
    price: ext.yandex_price ? formatMoney(Number(ext.yandex_price)) : null,
    courier: ext.yandex_courier ?? null,
  };
}
