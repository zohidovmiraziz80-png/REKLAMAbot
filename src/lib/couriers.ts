import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUzPhone } from "@/lib/phone";
import { formatMoney } from "@/lib/shop/format";
import { notifyCustomerStatus, notifyCustomerText } from "@/lib/shop/notify";
import { tg } from "@/lib/telegram/api";
import { loadMainBot } from "@/lib/telegram/main-bot";

/** Do'konning o'z kuryerlari: buyurtmani biriktirish va «Yetkazdim» */

export class CourierError extends Error {}

const COLS = "id, workspace_id, number, status, customer_name, phone, address, comment, items, total, payment_status, payment_method, chat_id, bot_project_id, external_ids";
type Order = {
  id: string;
  workspace_id: string;
  number: number;
  status: string;
  customer_name: string | null;
  phone: string;
  address: string | null;
  comment: string | null;
  items: { name: string; qty: number }[];
  total: number;
  payment_status: string;
  payment_method: string;
  chat_id: number | null;
  bot_project_id: string | null;
  external_ids: Record<string, string> | null;
};

async function saveExt(db: SupabaseClient, id: string, patch: Record<string, string>) {
  const { data } = await db.from("orders").select("external_ids").eq("id", id).maybeSingle();
  await db
    .from("orders")
    .update({ external_ids: { ...((data?.external_ids as Record<string, string> | null) ?? {}), ...patch } })
    .eq("id", id);
}

export async function assignCourier(db: SupabaseClient, workspaceId: string, orderId: string, courierChatId: number) {
  const bot = await loadMainBot(db, workspaceId);
  if (!bot) throw new CourierError("Telegram bot ulanmagan");
  const courier = bot.config.couriers.find((c) => c.chatId === courierChatId);
  if (!courier) throw new CourierError("Kuryer topilmadi");
  const { data } = await db.from("orders").select(COLS).eq("id", orderId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new CourierError("Buyurtma topilmadi");
  const o = data as unknown as Order;
  if (o.status === "cancelled" || o.status === "done") throw new CourierError("Bu buyurtma yopilgan");

  const geo = o.external_ids?.geo;
  const map = geo ? `https://yandex.uz/maps/?pt=${geo.split(",").reverse().join(",")}&z=17&l=map` : o.address ? `https://yandex.uz/maps/?text=${encodeURIComponent(o.address)}` : null;
  const cash = o.payment_status !== "paid";
  const text = [
    `🛵 Yangi yetkazish — №${o.number}`,
    "",
    `👤 ${o.customer_name ?? "Mijoz"}`,
    `📞 ${formatUzPhone(o.phone)}`,
    `📍 ${o.address ?? "manzil ko'rsatilmagan"}`,
    o.comment ? `💬 ${o.comment}` : "",
    "",
    o.items.map((i) => `• ${i.name} × ${i.qty}`).join("\n"),
    "",
    cash ? `💵 Mijozdan olinadi: ${formatMoney(o.total)}` : `✅ To'langan (${formatMoney(o.total)})`,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
  const keyboard = [[{ text: "✅ Yetkazdim", callback_data: `cd:${o.id}` }], ...(map ? [[{ text: "🗺 Xaritada ochish", url: map }]] : [])];
  try {
    await tg(bot.token, "sendMessage", { chat_id: courier.chatId, text: text.slice(0, 4000), reply_markup: { inline_keyboard: keyboard } });
  } catch {
    throw new CourierError("Kuryerga yuborilmadi — u botni bloklagan bo'lishi mumkin");
  }
  await saveExt(db, o.id, { courier: String(courier.chatId), courier_name: courier.name });
  if (o.status === "new" || o.status === "confirmed") {
    await db.from("orders").update({ status: "delivering" }).eq("id", o.id);
    await notifyCustomerStatus(db, o, "delivering");
  }
  await notifyCustomerText(db, o, `🛵 Buyurtma №${o.number}: kuryer ${courier.name} yo'lga chiqdi.`);
  return courier.name;
}

/** Kuryer «Yetkazdim» ni bosdi */
export async function courierDelivered(db: SupabaseClient, workspaceId: string, orderId: string, courierChatId: number) {
  const { data } = await db.from("orders").select(COLS).eq("id", orderId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) return "Buyurtma topilmadi";
  const o = data as unknown as Order;
  if (o.external_ids?.courier !== String(courierChatId)) return "Bu buyurtma sizga biriktirilmagan";
  if (o.status === "done") return "Allaqachon yakunlangan";
  if (o.status === "cancelled") return "Buyurtma bekor qilingan";
  await db.from("orders").update({ status: "done" }).eq("id", o.id);
  await notifyCustomerStatus(db, o, "done");
  const bot = await loadMainBot(db, workspaceId);
  if (bot?.ownerChatId) {
    await tg(bot.token, "sendMessage", {
      chat_id: bot.ownerChatId,
      text: `✅ Kuryer ${o.external_ids?.courier_name ?? ""} №${o.number} buyurtmani yetkazdi${o.payment_status !== "paid" ? ` — ${formatMoney(o.total)} naqd olinishi kerak edi` : ""}.`,
    }).catch(() => undefined);
  }
  return "ok";
}
