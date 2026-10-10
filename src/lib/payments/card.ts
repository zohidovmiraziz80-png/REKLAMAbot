import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoney } from "@/lib/shop/format";
import { tg } from "@/lib/telegram/api";
import { markOrderPaid, ownerBots } from "./core";
import { parsePaymentSms } from "./sms-parse";

/**
 * Kartaga o'tkazma:
 *  1) Buyurtmaga noyob summa beriladi (jami − 1…99 so'm), mijoz aynan shuni o'tkazadi.
 *  2) Bank bildirishnomalari tushadigan Telegram kanalga bot administrator qilinadi.
 *  3) Kanalga yangi xabar kelganda bot summani o'qiydi va mos buyurtmani "to'landi" qiladi.
 */

const MATCH_WINDOW_HOURS = 72;

export async function assignPayAmount(db: SupabaseClient, workspaceId: string, orderId: string, total: number): Promise<number> {
  const since = new Date(Date.now() - MATCH_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { data } = await db
    .from("orders")
    .select("pay_amount")
    .eq("workspace_id", workspaceId)
    .eq("payment_status", "unpaid")
    .not("pay_amount", "is", null)
    .gte("created_at", since)
    .gte("pay_amount", total - 100)
    .lte("pay_amount", total);
  const used = new Set((data ?? []).map((r) => Number(r.pay_amount)));
  let amount = total;
  if (total > 1000) {
    const free: number[] = [];
    for (let t = 1; t <= 99; t++) if (!used.has(total - t)) free.push(total - t);
    if (free.length) amount = free[Math.floor(Math.random() * free.length)];
  }
  await db.from("orders").update({ pay_amount: amount }).eq("id", orderId);
  return amount;
}

type ChannelPost = { message_id: number; chat: { id: number; type: string; title?: string }; text?: string; caption?: string };
type Bot = { project_id: string; workspace_id: string; token: string };

/** Kanalda "/tolov KOD" — shu kanal to'lov bildirishnomalari kanali sifatida ulanadi */
async function linkChannel(db: SupabaseClient, bot: Bot, post: ChannelPost, code: string) {
  const { data: s } = await db.from("shop_settings").select("pay_channel_code").eq("workspace_id", bot.workspace_id).maybeSingle();
  if (!s || s.pay_channel_code !== code.toLowerCase()) {
    await tg(bot.token, "sendMessage", { chat_id: post.chat.id, text: "❌ Kod noto'g'ri. Kodni MIXBOT → To'lovlar → Kartaga o'tkazma sahifasidan oling." }).catch(() => undefined);
    return;
  }
  await db
    .from("shop_settings")
    .update({ pay_channel_chat_id: post.chat.id, pay_channel_title: (post.chat.title ?? "").slice(0, 120) || null, pay_channel_bot_project_id: bot.project_id })
    .eq("workspace_id", bot.workspace_id);
  await tg(bot.token, "deleteMessage", { chat_id: post.chat.id, message_id: post.message_id }).catch(() => undefined);
  await tg(bot.token, "sendMessage", {
    chat_id: post.chat.id,
    text: "✅ Kanal ulandi. Endi bu yerga tushgan to'lov xabarlarini tekshirib, mos buyurtmani avtomatik «to'landi» qilaman.",
  }).catch(() => undefined);
}

async function notifyOwners(db: SupabaseClient, workspaceId: string, text: string) {
  const bots = await ownerBots(db, workspaceId);
  const sent = new Set<number>();
  for (const b of bots) {
    if (b.ownerChatId && !sent.has(b.ownerChatId)) {
      sent.add(b.ownerChatId);
      await tg(b.token, "sendMessage", { chat_id: b.ownerChatId, text }).catch(() => undefined);
    }
  }
}

export async function handleChannelPost(db: SupabaseClient, bot: Bot, post: ChannelPost) {
  const text = (post.text ?? post.caption ?? "").trim();
  if (!text) return;
  const cmd = text.match(/^\/tolov(?:@\w+)?\s+([a-z0-9]{6,32})$/i);
  if (cmd) return linkChannel(db, bot, post, cmd[1]);

  const { data: s } = await db
    .from("shop_settings")
    .select("pay_channel_chat_id, pay_channel_bot_project_id")
    .eq("workspace_id", bot.workspace_id)
    .maybeSingle();
  if (!s || s.pay_channel_chat_id !== post.chat.id || s.pay_channel_bot_project_id !== bot.project_id) return;

  await matchPaymentText(db, bot, text, post.chat.id, post.message_id, { methods: ["card", "click"], notify: true });
}

/**
 * To'lov xabari matnidan (bank SMS, Click/Payme bot xabari) mos buyurtmani topib "to'landi" qiladi.
 * methods — qaysi to'lov usulidagi buyurtmalar orasidan summa bo'yicha qidirish.
 * notify=false bo'lsa natija shu chatga javob qilib yoziladi (ega xabarni o'zi yuborgan holat).
 */
export async function matchPaymentText(
  db: SupabaseClient,
  bot: Bot,
  text: string,
  chatId: number,
  messageId: number,
  opts: { methods: string[]; notify: boolean },
): Promise<"paid" | "ambiguous" | "none" | "skip"> {
  const parsed = parsePaymentSms(text);
  if (!parsed || !parsed.incoming) return "skip";

  // Bir xabarni ikki marta hisoblamaslik uchun
  const externalId = parsed.txnId ? `txn:${parsed.txnId}` : `${chatId}:${messageId}`;
  const { data: existing } = await db.from("payment_transactions").select("id").in("provider", ["card", "click"]).eq("external_id", externalId).maybeSingle();
  if (existing) return "skip";
  const logProvider = /click/i.test(text) ? "click" : "card";

  const since = new Date(Date.now() - MATCH_WINDOW_HOURS * 3600 * 1000).toISOString();
  type Match = { id: string; number: number; total: number; payment_method: string };
  let matches: Match[] = [];
  // 1) Xabarda buyurtma id bo'lsa (Click to'lovida transaction_param) — aniq moslik
  if (parsed.orderRef) {
    const { data } = await db
      .from("orders")
      .select("id, number, total, payment_method")
      .eq("workspace_id", bot.workspace_id)
      .eq("id", parsed.orderRef)
      .eq("payment_status", "unpaid")
      .neq("status", "cancelled")
      .maybeSingle();
    if (data) matches = [data as unknown as Match];
  }
  // 2) Summa bo'yicha: kartaga o'tkazma (noyob summa) yoki Click buyurtmalari
  const base = () =>
    db
      .from("orders")
      .select("id, number, total, payment_method")
      .eq("workspace_id", bot.workspace_id)
      .in("payment_method", opts.methods)
      .eq("payment_status", "unpaid")
      .neq("status", "cancelled")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
  if (!matches.length) {
    const { data } = await base().eq("pay_amount", parsed.amount);
    matches = (data ?? []) as unknown as Match[];
  }
  // Mijoz yaxlitlab o'tkazgan bo'lsa yoki Click buyurtmasi — jami summa bo'yicha
  if (!matches.length) {
    const { data } = await base().eq("total", parsed.amount);
    matches = (data ?? []) as unknown as Match[];
  }

  const reply = (t: string) =>
    tg(bot.token, "sendMessage", { chat_id: chatId, text: t, reply_parameters: { message_id: messageId, allow_sending_without_reply: true } }).catch(
      () => undefined,
    );

  if (matches.length === 1) {
    const o = matches[0];
    const provider = o.payment_method === "click" || logProvider === "click" ? "click" : "card";
    await db.from("payment_transactions").insert({
      workspace_id: bot.workspace_id,
      order_id: o.id,
      provider,
      external_id: externalId,
      amount: parsed.amount,
      state: 2,
      perform_time: Date.now(),
      raw: { text: text.slice(0, 1000) },
    });
    await markOrderPaid(db, o.id, provider);
    await reply(`✅ №${o.number} buyurtma to'landi deb belgilandi (${formatMoney(parsed.amount)})`);
    return "paid";
  }

  await db.from("payment_transactions").insert({
    workspace_id: bot.workspace_id,
    order_id: null,
    provider: logProvider,
    external_id: externalId,
    amount: parsed.amount,
    state: 1,
    raw: { text: text.slice(0, 1000) },
  });
  const msgNone = `💳 ${formatMoney(parsed.amount)} to'lov keldi, lekin shu summadagi to'lanmagan buyurtma topilmadi.`;
  const msgMany = `💳 ${formatMoney(parsed.amount)} to'lov keldi. Bir nechta mos buyurtma bor: ${matches.map((m) => `№${m.number}`).join(", ")}. Qaysi biri to'langanini buyurtma xabaridagi «💳 To'landi» tugmasi bilan belgilang.`;
  const out = matches.length ? msgMany : msgNone;
  if (opts.notify) await notifyOwners(db, bot.workspace_id, out);
  else await reply(out);
  return matches.length ? "ambiguous" : "none";
}
