import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";
import { formatMoney } from "@/lib/shop/format";
import { tg } from "@/lib/telegram/api";
import type { ClickConfig, MulticardConfig, PayProvider, PaymeConfig } from "./config";
import { PAY_LABELS } from "./config";

/**
 * To'lov havolasini yaratish va to'lov natijasini buyurtmaga yozish.
 */

export function paymeCheckoutUrl(cfg: PaymeConfig, orderId: string, amountSom: number, returnUrl: string) {
  const params = [`m=${cfg.merchantId}`, `ac.order_id=${orderId}`, `a=${Math.round(amountSom * 100)}`, `c=${returnUrl}`, "l=uz"].join(";");
  const base = cfg.testMode ? "https://checkout.test.paycom.uz/" : "https://checkout.paycom.uz/";
  return base + Buffer.from(params, "utf8").toString("base64");
}

export function clickCheckoutUrl(cfg: ClickConfig, orderId: string, amountSom: number, returnUrl: string) {
  const q = new URLSearchParams({
    service_id: cfg.serviceId,
    merchant_id: cfg.merchantId,
    amount: amountSom.toFixed(2),
    transaction_param: orderId,
    return_url: returnUrl,
  });
  if (cfg.merchantUserId) q.set("merchant_user_id", cfg.merchantUserId);
  return `https://my.click.uz/services/pay?${q.toString()}`;
}

function multicardBase(cfg: MulticardConfig) {
  return cfg.testMode ? "https://dev-mesh.multicard.uz" : "https://mesh.multicard.uz";
}

async function multicardToken(cfg: MulticardConfig): Promise<string> {
  const res = await fetch(`${multicardBase(cfg)}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ application_id: cfg.applicationId, secret: cfg.secret }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; message?: string; error?: { details?: string } };
  if (!res.ok || !data.token) throw new Error(data.message || data.error?.details || "Multicard: avtorizatsiya xatosi");
  return data.token;
}

export async function multicardCheckoutUrl(
  db: SupabaseClient,
  cfg: MulticardConfig,
  order: { id: string; workspace_id: string; number: number; total: number },
  returnUrl: string,
  callbackUrl: string,
): Promise<string> {
  const token = await multicardToken(cfg);
  const res = await fetch(`${multicardBase(cfg)}/payment/invoice`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      store_id: Number(cfg.storeId),
      amount: Math.round(order.total * 100),
      invoice_id: order.id,
      callback_url: callbackUrl,
      return_url: returnUrl,
      lang: "uz",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { checkout_url?: string; uuid?: string };
    checkout_url?: string;
    uuid?: string;
    error?: { details?: string };
    message?: string;
  };
  const data = json.data ?? json;
  if (!res.ok || !data.checkout_url) throw new Error(json.error?.details || json.message || "Multicard: invoys yaratilmadi");
  if (data.uuid) {
    await db.from("payment_transactions").upsert(
      { workspace_id: order.workspace_id, order_id: order.id, provider: "multicard", external_id: data.uuid, amount: order.total, state: 1 },
      { onConflict: "provider,external_id" },
    );
  }
  return data.checkout_url;
}

async function ownerBots(db: SupabaseClient, workspaceId: string) {
  const { data } = await db.from("bots").select("project_id, token_encrypted, owner_chat_id").eq("workspace_id", workspaceId);
  return (data ?? []).flatMap((b) => {
    try {
      return [{ projectId: b.project_id as string, token: decryptSecret(b.token_encrypted as string), ownerChatId: (b.owner_chat_id as number | null) ?? null }];
    } catch {
      return [];
    }
  });
}

/** Buyurtmani "to'langan" deb belgilaydi va egasiga hamda mijozga Telegram'da xabar beradi (bir marta) */
export async function markOrderPaid(db: SupabaseClient, orderId: string, provider: PayProvider) {
  const { data: order } = await db
    .from("orders")
    .update({ payment_status: "paid", payment_method: provider, paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .neq("payment_status", "paid")
    .select("workspace_id, number, total, chat_id, bot_project_id")
    .maybeSingle();
  if (!order) return; // allaqachon to'langan
  try {
    const bots = await ownerBots(db, order.workspace_id as string);
    const text = `💳 Buyurtma №${order.number} to'landi — ${formatMoney(order.total as number)} (${PAY_LABELS[provider]})`;
    const sent = new Set<number>();
    for (const b of bots) {
      if (b.ownerChatId && !sent.has(b.ownerChatId)) {
        sent.add(b.ownerChatId);
        await tg(b.token, "sendMessage", { chat_id: b.ownerChatId, text }).catch(() => undefined);
      }
    }
    const { data: s } = await db.from("shop_settings").select("group_chat_id, group_bot_project_id").eq("workspace_id", order.workspace_id).maybeSingle();
    if (s?.group_chat_id) {
      const gb = bots.find((b) => b.projectId === s.group_bot_project_id) ?? bots[0];
      if (gb) await tg(gb.token, "sendMessage", { chat_id: s.group_chat_id, text }).catch(() => undefined);
    }
    if (order.chat_id && order.bot_project_id) {
      const cb = bots.find((b) => b.projectId === order.bot_project_id);
      if (cb) await tg(cb.token, "sendMessage", { chat_id: order.chat_id, text: `✅ To'lov qabul qilindi. Buyurtma №${order.number} — ${formatMoney(order.total as number)}` }).catch(() => undefined);
    }
  } catch {
    // xabar yuborilmasa ham to'lov saqlangan
  }
}

export async function markOrderRefunded(db: SupabaseClient, orderId: string) {
  await db.from("orders").update({ payment_status: "refunded" }).eq("id", orderId);
}
