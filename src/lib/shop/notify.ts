import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";
import { formatUzPhone } from "@/lib/phone";
import { tg } from "@/lib/telegram/api";
import {
  DELIVERY_LABELS,
  ORDER_STATUS_EMOJI,
  ORDER_STATUS_LABELS,
  SOURCE_LABELS,
  formatMoney,
  type OrderItem,
  type OrderStatus,
} from "./format";

/**
 * Buyurtma haqida Telegram xabarlari: egaga/guruhga yangi buyurtma, mijozga holat o'zgarishi.
 * Faqat serverda, service role klienti bilan chaqiriladi. Xatolar buyurtmani to'xtatmaydi.
 */

type BotRow = { project_id: string; token: string; owner_chat_id: number | null };

export type OrderRow = {
  id: string;
  workspace_id: string;
  number: number;
  source: keyof typeof SOURCE_LABELS;
  bot_project_id: string | null;
  chat_id: number | null;
  customer_name: string | null;
  phone: string;
  address: string | null;
  comment: string | null;
  delivery_method: keyof typeof DELIVERY_LABELS;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  delivery_price: number;
  total: number;
  payment_method?: string;
  payment_status?: string;
  pay_amount?: number | null;
};

export const ORDER_COLUMNS =
  "id, workspace_id, number, source, bot_project_id, chat_id, customer_name, phone, address, comment, delivery_method, status, items, subtotal, delivery_price, total, payment_method, payment_status, pay_amount";

const LEGACY_ORDER_COLUMNS =
  "id, workspace_id, number, source, bot_project_id, chat_id, customer_name, phone, address, comment, delivery_method, status, items, subtotal, delivery_price, total, payment_method, payment_status";

/** Buyurtmani o'qish (yangi ustunlar hali bazada bo'lmasa — eski ro'yxat bilan) */
export async function loadOrderRow(db: SupabaseClient, id: string, workspaceId?: string): Promise<OrderRow | null> {
  const run = (cols: string) => {
    let q = db.from("orders").select(cols).eq("id", id);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    return q.maybeSingle();
  };
  const first = await run(ORDER_COLUMNS);
  if (!first.error) return (first.data as unknown as OrderRow | null) ?? null;
  const second = await run(LEGACY_ORDER_COLUMNS);
  return (second.data as unknown as OrderRow | null) ?? null;
}

const PAY_METHOD_LABELS: Record<string, string> = { cash: "Naqd", card: "Kartaga o'tkazma", payme: "Payme", click: "Click", multicard: "Multicard" };

async function loadBots(db: SupabaseClient, workspaceId: string): Promise<BotRow[]> {
  const { data } = await db
    .from("bots")
    .select("project_id, token_encrypted, owner_chat_id, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  const out: BotRow[] = [];
  for (const b of data ?? []) {
    try {
      out.push({ project_id: b.project_id as string, token: decryptSecret(b.token_encrypted as string), owner_chat_id: (b.owner_chat_id as number | null) ?? null });
    } catch {
      // shifrni ochib bo'lmasa, bu botni o'tkazib yuboramiz
    }
  }
  return out;
}

export function orderAdminText(o: OrderRow, statusOverride?: OrderStatus) {
  const status = statusOverride ?? o.status;
  const items = (o.items ?? []).map((i) => `• ${i.name} × ${i.qty} = ${formatMoney(i.price * i.qty)}`).join("\n");
  const lines = [
    `🛒 Buyurtma №${o.number}`,
    `${ORDER_STATUS_EMOJI[status]} ${ORDER_STATUS_LABELS[status]} · ${SOURCE_LABELS[o.source] ?? o.source}`,
    "",
    items,
    "",
    o.delivery_price ? `Mahsulotlar: ${formatMoney(o.subtotal)}\nYetkazish: ${formatMoney(o.delivery_price)}` : "",
    `💰 Jami: ${formatMoney(o.total)}`,
    o.payment_method
      ? `💳 ${PAY_METHOD_LABELS[o.payment_method] ?? o.payment_method} · ${o.payment_status === "paid" ? "✅ to'langan" : o.payment_status === "refunded" ? "↩️ qaytarilgan" : "⏳ to'lanmagan"}${o.payment_method === "card" && o.pay_amount && o.payment_status !== "paid" ? ` (kutilmoqda: ${formatMoney(o.pay_amount)})` : ""}`
      : "",
    "",
    `👤 ${o.customer_name ?? "—"}`,
    `📞 ${formatUzPhone(o.phone)}`,
    `🚚 ${DELIVERY_LABELS[o.delivery_method] ?? o.delivery_method}${o.address ? `: ${o.address}` : ""}`,
    o.comment ? `💬 ${o.comment}` : "",
  ];
  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n").slice(0, 4000);
}

export function orderAdminKeyboard(o: Pick<OrderRow, "id" | "payment_status">, status: OrderStatus) {
  if (status === "cancelled") return { inline_keyboard: [] };
  const payRow = o.payment_status === "unpaid" ? [[{ text: "💳 To'landi deb belgilash", callback_data: `pp:${o.id}` }]] : [];
  if (status === "done") return { inline_keyboard: payRow };
  const btn = (s: OrderStatus, text: string) => ({ text, callback_data: `os:${o.id}:${s}` });
  const rows: { text: string; callback_data: string }[][] =
    status === "new"
      ? [[btn("confirmed", "✅ Tasdiqlash"), btn("cancelled", "❌ Bekor qilish")]]
      : status === "confirmed"
        ? [[btn("delivering", "🚚 Yo'lga chiqdi"), btn("done", "🎉 Yakunlash")], [btn("cancelled", "❌ Bekor qilish")]]
        : [[btn("done", "🎉 Yakunlash"), btn("cancelled", "❌ Bekor qilish")]];
  return { inline_keyboard: [...rows, ...payRow] };
}

/** Yangi buyurtma: bot egasiga va ulangan guruhga xabar, mijozga tasdiq */
export async function notifyNewOrder(db: SupabaseClient, order: OrderRow, thanks?: string, customerExtra?: string) {
  try {
    const bots = await loadBots(db, order.workspace_id);
    if (!bots.length) return;
    const { data: settings } = await db
      .from("shop_settings")
      .select("group_chat_id, group_bot_project_id")
      .eq("workspace_id", order.workspace_id)
      .maybeSingle();

    const text = orderAdminText(order);
    const keyboard = orderAdminKeyboard(order, order.status);
    const sent = new Set<string>();
    const sendTo = async (bot: BotRow, chatId: number) => {
      const key = `${bot.project_id}:${chatId}`;
      if (sent.has(key)) return;
      sent.add(key);
      try {
        await tg(bot.token, "sendMessage", { chat_id: chatId, text, reply_markup: keyboard });
      } catch {
        // yuborilmasa ham davom etamiz
      }
    };

    // Guruh
    if (settings?.group_chat_id) {
      const gb = bots.find((b) => b.project_id === settings.group_bot_project_id) ?? bots[0];
      await sendTo(gb, settings.group_chat_id as number);
    }
    // Ega: buyurtma kelgan bot, bo'lmasa egasi ulangan birinchi bot
    const ownerBot = bots.find((b) => b.project_id === order.bot_project_id && b.owner_chat_id) ?? bots.find((b) => b.owner_chat_id);
    if (ownerBot?.owner_chat_id) await sendTo(ownerBot, ownerBot.owner_chat_id);

    // Mijozga tasdiq (Mini App orqali kelgan bo'lsa)
    if (order.chat_id && order.bot_project_id) {
      const cb = bots.find((b) => b.project_id === order.bot_project_id);
      if (cb) {
        const items = order.items.map((i) => `• ${i.name} × ${i.qty}`).join("\n");
        try {
          await tg(cb.token, "sendMessage", {
            chat_id: order.chat_id,
            text: `✅ Buyurtmangiz qabul qilindi!\n\n🛒 №${order.number}\n${items}\n💰 Jami: ${formatMoney(order.total)}\n\n${customerExtra ? `${customerExtra}\n\n` : ""}${thanks || "Tez orada siz bilan bog'lanamiz."}`.slice(0, 4000),
          });
        } catch {
          // mijoz botni bloklagan bo'lishi mumkin
        }
      }
    }
  } catch (err) {
    console.error("Buyurtma xabari yuborilmadi:", err instanceof Error ? err.message : "noma'lum");
  }
}

const CUSTOMER_STATUS_TEXT: Record<OrderStatus, string> = {
  new: "qabul qilindi",
  confirmed: "tasdiqlandi ✅",
  delivering: "yo'lga chiqdi 🚚",
  done: "yakunlandi 🎉 Xaridingiz uchun rahmat!",
  cancelled: "bekor qilindi ❌",
};

/** Holat o'zgarganda mijozga Telegram orqali xabar */
export async function notifyCustomerStatus(db: SupabaseClient, order: Pick<OrderRow, "workspace_id" | "number" | "chat_id" | "bot_project_id">, status: OrderStatus) {
  if (!order.chat_id || !order.bot_project_id || status === "new") return;
  try {
    const bots = await loadBots(db, order.workspace_id);
    const bot = bots.find((b) => b.project_id === order.bot_project_id);
    if (!bot) return;
    await tg(bot.token, "sendMessage", { chat_id: order.chat_id, text: `🛒 Buyurtma №${order.number} ${CUSTOMER_STATUS_TEXT[status]}` });
  } catch {
    // mijoz botni bloklagan bo'lishi mumkin
  }
}
