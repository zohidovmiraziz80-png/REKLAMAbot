import type { SupabaseClient } from "@supabase/supabase-js";
import { handleOwnerReply, logAiReply, logIncoming, recentHistory } from "@/lib/chat";
import { answerCustomer } from "@/lib/ai/assistant";
import { handleChannelPost, matchPaymentText } from "@/lib/payments/card";
import { markOrderPaid } from "@/lib/payments/core";
import { formatUzPhone, normalizeUzPhone } from "@/lib/phone";
import { getWorkspacePlan } from "@/lib/plans";
import { publicSiteUrls } from "@/lib/site/hosting";
import { CUSTOMER_STATUS_LABELS, ORDER_STATUSES, ORDER_STATUS_EMOJI, ORDER_STATUS_LABELS, PAY_METHOD_LABELS, formatMoney, type OrderStatus } from "@/lib/shop/format";
import { dispatchYandex, estimateYandex } from "@/lib/delivery/yandex-flow";
import { YandexError } from "@/lib/delivery/yandex";
import { hasCouriers, hasYandex, loadOrderRow, notifyCustomerStatus, orderAdminKeyboard, orderAdminText, type OrderRow } from "@/lib/shop/notify";
import { tg } from "./api";
import { linkCode, loadMainBot, updateBotConfig } from "./main-bot";
import { assignCourier, courierDelivered, CourierError } from "@/lib/couriers";
import { withChatLink } from "./chat-link";
import { botConfigSchema, buttonRows, safeBotUrl, safeWebAppUrl, type BotConfig } from "./config";

/**
 * Telegram'dan kelgan har bir xabarni qayta ishlaydi:
 * /start → salom + menyu; menyu tugmalari → javob; ariza oqimi → telefon → xabar → saqlash + egaga xabar.
 */

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };
type TgMessage = {
  message_id: number;
  chat: { id: number; type: string; title?: string };
  from?: TgUser;
  text?: string;
  caption?: string;
  contact?: { phone_number: string; user_id?: number };
  /** Boshqa joydan forward qilingan xabar (masalan Click bot to'lov xabari) */
  forward_origin?: unknown;
  forward_date?: number;
  reply_to_message?: { message_id: number };
};
type TgCallback = {
  id: string;
  from: TgUser;
  data?: string;
  message?: { message_id: number; chat: { id: number; type: string } };
};
type TgChannelPost = { message_id: number; chat: { id: number; type: string; title?: string }; text?: string; caption?: string };
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallback; channel_post?: TgChannelPost };

export type BotRuntime = {
  project_id: string;
  workspace_id: string;
  owner_link_code: string;
  owner_chat_id: number | null;
  config: unknown;
  token: string;
};

type ChatState = {
  step?: "phone" | "message" | "login";
  phone?: string;
  token?: string;
  startedAt?: number;
  /** Saytga kirish tasdiqlandi — sayt shu kod bilan sessiya oladi */
  login?: { n: string; phone: string; name: string; at: number };
};

const CANCEL = "❌ Bekor qilish";
const SHARE_PHONE = "📱 Raqamni yuborish";
const LOGIN_SHARE = "📱 Raqamni yuborish va kirish";

/** Mini App manzili: shu chat uchun imzolangan parametr bilan (buyurtma mijozga bog'lanishi uchun) */
function appUrl(raw: string, link?: { botProjectId: string; chatId: number }) {
  const url = safeWebAppUrl(raw);
  if (!url || !link) return url;
  try {
    return withChatLink(url, link.botProjectId, link.chatId);
  } catch {
    return url;
  }
}

function menuKeyboard(cfg: BotConfig, link?: { botProjectId: string; chatId: number }) {
  if (!cfg.buttons.length) return { remove_keyboard: true };
  const rows = buttonRows(cfg.buttons).map((row) =>
    row.map((b) => {
      const url = b.type === "webapp" ? appUrl(b.url || cfg.siteUrl, link) : null;
      return url ? { text: b.label, web_app: { url } } : { text: b.label };
    }),
  );
  return { keyboard: rows, resize_keyboard: true, is_persistent: true };
}

const phoneKeyboard = () => ({
  keyboard: [[{ text: SHARE_PHONE, request_contact: true }], [{ text: CANCEL }]],
  resize_keyboard: true,
  one_time_keyboard: true,
});

const cancelKeyboard = () => ({ keyboard: [[{ text: CANCEL }]], resize_keyboard: true });

function parsePhone(msg: TgMessage, text: string): string | null {
  if (msg.contact?.phone_number) {
    const raw = msg.contact.phone_number.startsWith("+") ? msg.contact.phone_number : `+${msg.contact.phone_number}`;
    const n = normalizeUzPhone(raw);
    return n ? formatUzPhone(n) : raw.replace(/[^\d+]/g, "").slice(0, 20);
  }
  if (text) {
    const n = normalizeUzPhone(text);
    if (n) return formatUzPhone(n);
    const digits = text.replace(/[^\d+]/g, "");
    if (digits.replace("+", "").length >= 9 && digits.length <= 16) return digits;
  }
  return null;
}

/** Egasi yoki do'kon guruhi buyurtma xabaridagi tugmani bosganda holatni o'zgartiradi */
async function handleCallback(db: SupabaseClient, bot: BotRuntime, cb: TgCallback) {
  const answer = (text: string) => tg(bot.token, "answerCallbackQuery", { callback_query_id: cb.id, text }).catch(() => undefined);
  const data = cb.data ?? "";
  const pay = data.match(/^pp:([0-9a-f-]{36})$/);
  const yd = data.match(/^y([dc]):([0-9a-f-]{36})$/);
  const cd = data.match(/^cd:([0-9a-f-]{36})$/);
  const ck = data.match(/^ck:([0-9a-f-]{36})$/);
  const ca = data.match(/^ca:([0-9a-f-]{36}):(-?\d{1,16})$/);
  const m = pay || yd || cd || ck || ca ? null : data.match(/^os:([0-9a-f-]{36}):(\w+)$/);
  const chatId = cb.message?.chat.id;
  if ((!m && !pay && !yd && !cd && !ck && !ca) || !chatId || !cb.message) return answer("");

  // Kuryer «Yetkazdim» ni bosdi (ruxsat: aynan shu kuryer)
  if (cd) {
    const r = await courierDelivered(db, bot.workspace_id, cd[1], chatId);
    if (r !== "ok") return answer(r);
    await answer("✅ Rahmat!");
    await tg(bot.token, "editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
    await tg(bot.token, "sendMessage", { chat_id: chatId, text: "✅ Yetkazildi deb belgilandi." }).catch(() => undefined);
    return;
  }

  // Ruxsat: bot egasi, qo'shimcha adminlar (Telegram ID) yoki shu bot orqali ulangan do'kon guruhi
  let allowed = bot.owner_chat_id === chatId || botConfigSchema.parse(bot.config ?? {}).adminChatIds.includes(chatId);
  if (!allowed) {
    const { data: s } = await db.from("shop_settings").select("group_chat_id, group_bot_project_id").eq("workspace_id", bot.workspace_id).maybeSingle();
    allowed = !!s && s.group_chat_id === chatId && s.group_bot_project_id === bot.project_id;
  }
  if (!allowed) return answer("Ruxsat yo'q");

  const who = [cb.from.first_name, cb.from.username ? `@${cb.from.username}` : ""].filter(Boolean).join(" ");

  // O'z kuryerlari: ck — ro'yxatni ko'rsatish, ca — biriktirish
  if (ck || ca) {
    const mb = await loadMainBot(db, bot.workspace_id);
    const list = mb?.config.couriers ?? [];
    if (!list.length) return answer("Kuryer ulanmagan");
    if (ck) {
      await answer("");
      await tg(bot.token, "sendMessage", {
        chat_id: chatId,
        text: "🛵 Qaysi kuryerga berilsin?",
        reply_parameters: { message_id: cb.message.message_id, allow_sending_without_reply: true },
        reply_markup: { inline_keyboard: list.map((c) => [{ text: c.name, callback_data: `ca:${ck[1]}:${c.chatId}` }]) },
      }).catch(() => undefined);
      return;
    }
    try {
      const name = await assignCourier(db, bot.workspace_id, ca![1], Number(ca![2]));
      await answer(`🛵 ${name}ga berildi`);
      await tg(bot.token, "editMessageText", { chat_id: chatId, message_id: cb.message.message_id, text: `🛵 Kuryer: ${name} — buyurtma unga yuborildi.` }).catch(() => undefined);
    } catch (err) {
      await answer(err instanceof CourierError ? err.message : "Xatolik");
    }
    return;
  }

  // Yandex kuryer: yd — narxni ko'rsatish, yc — tasdiqlab chaqirish
  if (yd) {
    if (!(await hasYandex(db, bot.workspace_id))) return answer("Yandex Delivery ulanmagan");
    const orderId = yd[2];
    const reply = (text: string, reply_markup?: unknown) =>
      tg(bot.token, "sendMessage", { chat_id: chatId, text, reply_parameters: { message_id: cb.message!.message_id, allow_sending_without_reply: true }, ...(reply_markup ? { reply_markup } : {}) }).catch(() => undefined);
    try {
      if (yd[1] === "d") {
        await answer("Narx hisoblanmoqda…");
        const q = await estimateYandex(db, bot.workspace_id, orderId);
        await reply(
          `🚕 Yandex kuryer: taxminan ${formatMoney(q.price)}${q.distanceKm ? ` · ${q.distanceKm} km` : ""}${q.etaMinutes ? ` · ~${q.etaMinutes} daq` : ""}${q.approximate ? "\n⚠️ Manzil matndan topildi — mijoz bilan tekshirib oling." : ""}`,
          { inline_keyboard: [[{ text: `✅ Chaqirish (${formatMoney(q.price)})`, callback_data: `yc:${orderId}` }]] },
        );
      } else {
        await answer("Kuryer chaqirilmoqda…");
        const r = await dispatchYandex(db, bot.workspace_id, orderId);
        await tg(bot.token, "editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
        await reply(`✅ Yandex kuryer chaqirildi${r.price ? ` — ${formatMoney(r.price)}` : ""}. Holat o'zgarsa buyurtmaga yoziladi, mijozga xabar boradi.`);
      }
    } catch (err) {
      await reply(`❌ ${err instanceof YandexError ? err.message : "Xatolik. MIXBOT → Buyurtmalar sahifasidan urinib ko'ring."}`);
    }
    return;
  }

  // "To'landi" tugmasi (masalan, kartaga o'tkazma kanalga tushmagan bo'lsa)
  if (pay) {
    const order = await loadOrderRow(db, pay[1], bot.workspace_id);
    if (!order) return answer("Buyurtma topilmadi");
    const o = order as OrderRow;
    if (o.payment_status !== "paid") await markOrderPaid(db, o.id, (o.payment_method === "payme" || o.payment_method === "click" || o.payment_method === "multicard" ? o.payment_method : "card"), `✏️ Qo'lda belgilandi — ${who}`);
    await answer("💳 To'landi");
    const fresh = { ...o, payment_status: "paid" };
    await tg(bot.token, "editMessageText", {
      chat_id: chatId,
      message_id: cb.message.message_id,
      text: orderAdminText(fresh).slice(0, 4096),
      reply_markup: orderAdminKeyboard(fresh, o.status, { yandex: o.delivery_method === "courier" && (await hasYandex(db, bot.workspace_id)), courier: o.delivery_method === "courier" && (await hasCouriers(db, bot.workspace_id)) }),
    }).catch(() => undefined);
    return;
  }
  if (!m) return answer("");
  const status = m[2] as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return answer("");

  const order = await loadOrderRow(db, m[1], bot.workspace_id);
  if (!order) return answer("Buyurtma topilmadi");
  const o = order as OrderRow;
  if (o.status === "cancelled" || o.status === status) {
    await answer(`Holat: ${ORDER_STATUS_LABELS[o.status]}`);
  } else {
    const { error } = await db.from("orders").update({ status }).eq("id", o.id).eq("workspace_id", bot.workspace_id);
    if (error) return answer("Saqlanmadi");
    await answer(`${ORDER_STATUS_EMOJI[status]} ${ORDER_STATUS_LABELS[status]}`);
    await notifyCustomerStatus(db, o, status);
  }
  const current = o.status === "cancelled" ? "cancelled" : status;
  await tg(bot.token, "editMessageText", {
    chat_id: chatId,
    message_id: cb.message.message_id,
    text: `${orderAdminText(o, current)}\n\n✏️ ${ORDER_STATUS_LABELS[current]} — ${who}`.slice(0, 4096),
    reply_markup: orderAdminKeyboard(o, current, { yandex: o.delivery_method === "courier" && (await hasYandex(db, bot.workspace_id)), courier: o.delivery_method === "courier" && (await hasCouriers(db, bot.workspace_id)) }),
  }).catch(() => undefined);
}

/** Guruhda: "/ulash KOD" — buyurtmalar shu guruhga tushadigan bo'ladi */
async function handleGroupMessage(db: SupabaseClient, bot: BotRuntime, msg: TgMessage) {
  const text = (msg.text ?? "").trim();
  if (/^\/id(?:@\w+)?$/i.test(text)) {
    await tg(bot.token, "sendMessage", { chat_id: msg.chat.id, text: `Bu guruh ID: ${msg.chat.id}` }).catch(() => undefined);
    return;
  }
  // Do'kon guruhiga forward qilingan to'lov xabari (Click bot va h.k.)
  if (msg.forward_origin || msg.forward_date) {
    const { data: g } = await db.from("shop_settings").select("group_chat_id, group_bot_project_id").eq("workspace_id", bot.workspace_id).maybeSingle();
    if (g && g.group_chat_id === msg.chat.id && g.group_bot_project_id === bot.project_id) {
      await matchPaymentText(db, bot, (msg.text ?? msg.caption ?? "").trim(), msg.chat.id, msg.message_id, { methods: ["card", "click", "cash"], notify: false });
    }
    return;
  }
  if (/^\/tolov(?:@\w+)?\b/i.test(text)) {
    await tg(bot.token, "sendMessage", {
      chat_id: msg.chat.id,
      text: "ℹ️ Telegram qoidasi bo'yicha bot guruhda boshqa botlarning (masalan Click bot) xabarlarini ko'ra olmaydi. To'lov xabarlari uchun KANAL oching, Click bot va meni kanalga administrator qiling, so'ng kanalda shu buyruqni yozing.",
    }).catch(() => undefined);
    return;
  }
  const mm = text.match(/^\/ulash(?:@\w+)?\s+([a-z0-9]{6,32})$/i);
  if (!mm) return;
  const { data: s } = await db.from("shop_settings").select("group_link_code").eq("workspace_id", bot.workspace_id).maybeSingle();
  if (!s || s.group_link_code !== mm[1].toLowerCase()) {
    await tg(bot.token, "sendMessage", { chat_id: msg.chat.id, text: "❌ Kod noto'g'ri. Kodni MIXBOT → Buyurtmalar → Sozlamalar sahifasidan oling." }).catch(() => undefined);
    return;
  }
  await db
    .from("shop_settings")
    .update({ group_chat_id: msg.chat.id, group_title: (msg.chat.title ?? "").slice(0, 120) || null, group_bot_project_id: bot.project_id })
    .eq("workspace_id", bot.workspace_id);
  await tg(bot.token, "sendMessage", { chat_id: msg.chat.id, text: "✅ Guruh ulandi. Yangi buyurtmalar shu yerga keladi va tugmalar orqali holatini o'zgartirish mumkin." }).catch(() => undefined);
}

export async function handleUpdate(db: SupabaseClient, bot: BotRuntime, update: TgUpdate) {
  if (update.callback_query) {
    await handleCallback(db, bot, update.callback_query);
    return;
  }
  if (update.channel_post) {
    // Mahsulot postlari kanali: "/kanal KOD"
    const t = (update.channel_post.text ?? "").trim();
    const k = t.match(/^\/kanal(?:@\w+)?\s+([a-f0-9]{10})$/i);
    if (k) {
      const chat = update.channel_post.chat;
      if (k[1].toLowerCase() === linkCode(bot.owner_link_code, "channel")) {
        await updateBotConfig(db, bot.project_id, { postChannelId: chat.id, postChannelTitle: (chat.title ?? "").slice(0, 120) });
        await tg(bot.token, "deleteMessage", { chat_id: chat.id, message_id: update.channel_post.message_id }).catch(() => undefined);
        await tg(bot.token, "sendMessage", { chat_id: chat.id, text: "✅ Kanal MIXBOT'ga ulandi. Mahsulot va aksiya postlari shu yerga chiqadi." }).catch(() => undefined);
      } else {
        await tg(bot.token, "sendMessage", { chat_id: chat.id, text: "❌ Kod noto'g'ri. Kodni MIXBOT → Marketing → Telegram kanal bo'limidan oling." }).catch(() => undefined);
      }
      return;
    }
    await handleChannelPost(db, bot, update.channel_post);
    return;
  }
  const msg = update.message;
  if (!msg) return;
  if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
    await handleGroupMessage(db, bot, msg);
    return;
  }
  if (msg.chat.type !== "private") return;

  const chatId = msg.chat.id;
  const cfg = botConfigSchema.parse(bot.config ?? {});
  const link = { botProjectId: bot.project_id, chatId };
  const menu = () => (confirmOnly ? { remove_keyboard: true } : menuKeyboard(cfg, link));
  const text = (msg.text ?? "").trim();
  const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ").slice(0, 120) || null;
  const username = msg.from?.username ?? null;

  const send = (body: string, reply_markup?: unknown) =>
    tg(bot.token, "sendMessage", { chat_id: chatId, text: body.slice(0, 4000), ...(reply_markup ? { reply_markup } : {}) });

  const { data: sub } = await db
    .from("bot_subscribers")
    .upsert(
      {
        project_id: bot.project_id,
        workspace_id: bot.workspace_id,
        chat_id: chatId,
        first_name: name,
        username,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "project_id,chat_id" },
    )
    .select("state")
    .single();

  const state = ((sub?.state as ChatState | null) ?? {}) as ChatState;
  // Saqlangan savat (tashlab ketilgan savat eslatmasi uchun) suhbat holati o'zgarganda yo'qolmasin
  const savedCart = (sub?.state as { cart?: unknown } | null)?.cart;
  const setState = async (s: ChatState) => {
    await db
      .from("bot_subscribers")
      .update({ state: savedCart ? { ...s, cart: savedCart } : s })
      .eq("project_id", bot.project_id)
      .eq("chat_id", chatId);
  };

  // Ega to'lov xabarini (Click bot, bank SMS) botga forward qilsa — mos buyurtma "to'landi" bo'ladi
  if (bot.owner_chat_id === chatId && (msg.forward_origin || msg.forward_date)) {
    const r = await matchPaymentText(db, bot, (msg.text ?? msg.caption ?? "").trim(), chatId, msg.message_id, { methods: ["card", "click", "cash"], notify: false });
    if (r === "skip") await send("Bu xabarda to'lov summasi topilmadi (yoki u allaqachon hisobga olingan).");
    return;
  }

  // Ega mijoz xabariga Telegram'da reply qildi — javob mijozga boradi
  if (bot.owner_chat_id === chatId && msg.reply_to_message && text && !text.startsWith("/")) {
    const r = await handleOwnerReply(db, bot, msg.reply_to_message.message_id, text);
    if (r === "sent") {
      await send("✅ Javob mijozga yuborildi.");
      return;
    }
    if (r === "failed") {
      await send("❌ Yuborilmadi — mijoz botni bloklagan bo'lishi mumkin.");
      return;
    }
  }
  const who = `${name ?? "Mijoz"}${username ? ` (@${username})` : ""}`;

  // "Sayt" tarifi: bot faqat mijozni tasdiqlash va buyurtma xabarlari uchun
  const plan = await getWorkspacePlan(db, bot.workspace_id);
  const confirmOnly = !plan.botShop;
  const sendSiteLink = async (body: string) => {
    let url = safeBotUrl(cfg.siteUrl);
    if (!url) {
      const { data: pub } = await db.from("published_sites").select("slug").eq("workspace_id", bot.workspace_id).limit(1).maybeSingle();
      if (pub) {
        const u = publicSiteUrls(pub.slug as string);
        url = u.subdomainUrl ?? u.pathUrl;
      }
    }
    await send(body, url ? { inline_keyboard: [[{ text: "🛍 Saytga o'tish", url }]] } : { remove_keyboard: true });
  };

  // Telegram ID'ni bilish (Do'kon sozlamalariga admin qilib qo'shish uchun)
  if (/^\/id(?:@\w+)?$/i.test(text)) {
    await send(`🆔 Sizning Telegram ID: ${chatId}\n\nBuni MIXBOT → Buyurtmalar → Do'kon sozlamalari → «Buyurtma qabul qiluvchilar» ga qo'shing — yangi buyurtmalar shu yerga keladi.`);
    return;
  }

  // /start va administratorni ulash
  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1] ?? "";
    await setState({});
    const courierJoin = payload.match(/^courier_([a-f0-9]{10})$/);
    if (courierJoin) {
      if (courierJoin[1] !== linkCode(bot.owner_link_code, "courier")) {
        await send("❌ Havola noto'g'ri yoki eskirgan. Do'kon egasidan yangi havola so'rang.");
        return;
      }
      const mb = await loadMainBot(db, bot.workspace_id);
      if (!mb || mb.projectId !== bot.project_id) {
        await send("❌ Bu havola do'konning asosiy boti uchun emas.");
        return;
      }
      const others = mb.config.couriers.filter((c) => c.chatId !== chatId);
      await updateBotConfig(db, bot.project_id, { couriers: [...others, { chatId, name: name ?? username ?? "Kuryer" }] });
      await send("✅ Siz kuryer sifatida ulandingiz. Yetkazish buyurtmalari shu yerga keladi — manzil, telefon va «✅ Yetkazdim» tugmasi bilan.", { remove_keyboard: true });
      if (bot.owner_chat_id && bot.owner_chat_id !== chatId) {
        await tg(bot.token, "sendMessage", { chat_id: bot.owner_chat_id, text: `🛵 Yangi kuryer ulandi: ${name ?? "—"}${username ? ` (@${username})` : ""}` }).catch(() => undefined);
      }
      return;
    }
    const login = payload.match(/^login_([a-f0-9]{24})$/);
    if (login) {
      await setState({ step: "login", token: login[1], startedAt: Date.now() });
      await send("🔐 Saytga kirish uchun telefon raqamingizni tasdiqlang — pastdagi tugmani bosing 👇", {
        keyboard: [[{ text: LOGIN_SHARE, request_contact: true }], [{ text: CANCEL }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      });
      return;
    }
    if (payload && payload === `owner_${bot.owner_link_code}`) {
      await db.from("bots").update({ owner_chat_id: chatId }).eq("project_id", bot.project_id);
      await send("✅ Siz bu botning administratori sifatida ulandingiz. Yangi buyurtma va arizalar shu chatga keladi.", menu());
      return;
    }
    if (confirmOnly) {
      await sendSiteLink(`${cfg.welcome}\n\nBuyurtma berish saytimizda 👇`);
      return;
    }
    await send(cfg.welcome, menu());
    return;
  }

  if (text === CANCEL) {
    await setState({});
    await send("Bekor qilindi.", menu());
    return;
  }

  // Saytga kirish: faqat o'z raqamini (kontakt tugmasi orqali) qabul qilamiz
  if (state.step === "login" && state.token) {
    if (!msg.contact || (msg.contact.user_id && msg.contact.user_id !== msg.from?.id) || !msg.contact.user_id) {
      await send("Iltimos, pastdagi «📱 Raqamni yuborish va kirish» tugmasini bosing (raqamni qo'lda yozish qabul qilinmaydi).", {
        keyboard: [[{ text: LOGIN_SHARE, request_contact: true }], [{ text: CANCEL }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      });
      return;
    }
    const raw = msg.contact.phone_number.startsWith("+") ? msg.contact.phone_number : `+${msg.contact.phone_number}`;
    const phone = normalizeUzPhone(raw) ?? raw.replace(/[^\d+]/g, "").slice(0, 16);
    if (!state.startedAt || Date.now() - state.startedAt > 15 * 60 * 1000) {
      await setState({});
      await send("⏰ Kirish havolasi eskirgan. Saytda «Kirish» tugmasini qayta bosing.", menu());
      return;
    }
    await setState({ login: { n: state.token, phone, name: name ?? "", at: Date.now() } });
    // Mijozlar bazasi (CRM): yangi bo'lsa qo'shamiz, bor bo'lsa Telegram'ni bog'laymiz
    const { data: existing } = await db.from("customers").select("id, name").eq("workspace_id", bot.workspace_id).eq("phone", phone).maybeSingle();
    if (existing) {
      await db
        .from("customers")
        .update({ telegram_chat_id: chatId, telegram_username: username, ...(existing.name ? {} : { name }) })
        .eq("id", existing.id);
    } else {
      await db.from("customers").insert({ workspace_id: bot.workspace_id, phone, name, telegram_chat_id: chatId, telegram_username: username });
    }
    await send("✅ Raqamingiz tasdiqlandi! Saytga qayting — kabinetingiz avtomatik ochiladi.\n\nBuyurtmalaringiz holati shu yerga ham keladi.", menu());
    return;
  }

  if (confirmOnly) {
    const logged = text && !text.startsWith("/") ? await logIncoming(db, bot, chatId, who, text) : false;
    await sendSiteLink(
      logged
        ? "✉️ Xabaringiz yetkazildi, tez orada javob beramiz. Buyurtma berish uchun saytimizga o'ting 👇"
        : "Buyurtma berish va holatini ko'rish uchun saytimizga o'ting 👇 Buyurtma xabarlari shu yerga keladi.",
    );
    return;
  }

  // Ariza oqimi: 1) telefon
  if (state.step === "phone") {
    const phone = parsePhone(msg, text);
    if (!phone) {
      await send("Telefon raqamini to'g'ri kiriting (masalan +998 90 123 45 67) yoki pastdagi tugmani bosing.", phoneKeyboard());
      return;
    }
    await setState({ step: "message", phone });
    await send(cfg.requestMessagePrompt, cancelKeyboard());
    return;
  }

  // Ariza oqimi: 2) xabar
  if (state.step === "message") {
    if (!text) {
      await send("Iltimos, matn ko'rinishida yozing.", cancelKeyboard());
      return;
    }
    const phone = state.phone ?? "";
    await db.from("bot_requests").insert({
      project_id: bot.project_id,
      workspace_id: bot.workspace_id,
      chat_id: chatId,
      customer_name: name,
      username,
      phone,
      message: text.slice(0, 2000),
    });
    await setState({});
    await send(cfg.requestThanks, menu());

    if (bot.owner_chat_id && bot.owner_chat_id !== chatId) {
      const who = `${name ?? "—"}${username ? ` (@${username})` : ""}`;
      try {
        await tg(bot.token, "sendMessage", {
          chat_id: bot.owner_chat_id,
          text: `🆕 Yangi ariza\n\n👤 ${who}\n📞 ${phone || "—"}\n💬 ${text.slice(0, 1500)}`,
        });
      } catch {
        // egaga yuborib bo'lmasa ham ariza saqlangan
      }
    }
    return;
  }

  // Menyu tugmalari
  const button = cfg.buttons.find((b) => b.label === text);
  if (button) {
    if (button.type === "request") {
      await setState({ step: "phone" });
      await send(cfg.requestPhonePrompt, phoneKeyboard());
      return;
    }
    if (button.type === "orders") {
      const [{ data: orders }, { data: requests }] = await Promise.all([
        db
          .from("orders")
          .select("number, status, total, items, created_at, delivery_method, address, payment_method, payment_status")
          .eq("workspace_id", bot.workspace_id)
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(5),
        db
          .from("bot_requests")
          .select("id, message, status, created_at")
          .eq("project_id", bot.project_id)
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      const siteUrl = appUrl(cfg.siteUrl, link);
      if (!orders?.length && !requests?.length) {
        await send(
          "Sizda hali buyurtma yo'q.",
          siteUrl ? { inline_keyboard: [[{ text: "🛍 Do'konni ochish", web_app: { url: siteUrl } }]] } : menu(),
        );
        return;
      }
      const dateOf = (iso: string) => {
        const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
        return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      };
      const reqLabel: Record<string, string> = { new: "🆕 Qabul qilindi", in_progress: "⏳ Jarayonda", done: "✅ Bajarildi", cancelled: "❌ Bekor qilindi" };
      type Item = { name: string; qty: number; image_url?: string | null };
      // Har bir buyurtma alohida — mahsulot rasmlari bilan (eskisi yuqorida, yangisi pastda)
      for (const o of [...(orders ?? [])].reverse()) {
        const st = o.status as OrderStatus;
        const items = (o.items as Item[]) ?? [];
        const caption = [
          `🛒 Buyurtma №${o.number} · ${dateOf(o.created_at as string)}`,
          `Holat: ${CUSTOMER_STATUS_LABELS[st] ?? st}`,
          "",
          ...items.slice(0, 10).map((i) => `• ${i.name} × ${i.qty}`),
          "",
          o.delivery_method === "courier" ? `🚚 Yetkazib berish${o.address ? `: ${o.address}` : ""}` : "🏪 Olib ketish",
          `💳 ${PAY_METHOD_LABELS[o.payment_method as string] ?? o.payment_method} · ${o.payment_status === "paid" ? "to'langan ✅" : o.payment_status === "refunded" ? "qaytarilgan" : "to'lanmagan"}`,
          `💰 Jami: ${formatMoney(o.total as number)}`,
        ]
          .join("\n")
          .slice(0, 1000);
        const photos = items.map((i) => i.image_url).filter((u): u is string => !!u && /^https:\/\//.test(u)).slice(0, 10);
        try {
          if (photos.length > 1) {
            await tg(bot.token, "sendMediaGroup", { chat_id: chatId, media: photos.map((u, i) => ({ type: "photo", media: u, ...(i === 0 ? { caption } : {}) })) });
          } else if (photos.length === 1) {
            await tg(bot.token, "sendPhoto", { chat_id: chatId, photo: photos[0], caption });
          } else {
            await send(caption);
          }
        } catch {
          // rasm yuklanmasa — matn bilan
          await send(caption).catch(() => undefined);
        }
      }
      if (requests?.length) {
        await send(
          requests
            .map((r) => `📝 Ariza №${r.id} · ${dateOf(r.created_at as string)} · ${reqLabel[r.status as string] ?? r.status}\n${String(r.message).slice(0, 120)}`)
            .join("\n\n"),
        );
      }
      await send(orders?.length ? "👆 Oxirgi buyurtmalaringiz" : "👆 Arizalaringiz", menu());
      return;
    }
    if (button.type === "webapp") {
      // Mini App tugmasi odatda to'g'ridan-to'g'ri saytni ochadi; bu yerga faqat manzil noto'g'ri bo'lsa keladi
      const url = appUrl(button.url || cfg.siteUrl, link);
      if (url) await send("👇 Saytni ochish", { inline_keyboard: [[{ text: button.label, web_app: { url } }]] });
      else await send("Sayt hali ulanmagan.", menu());
      return;
    }
    if (button.type === "link") {
      const url = safeBotUrl(button.url);
      if (url) await send(button.text || button.label, { inline_keyboard: [[{ text: "Ochish ↗", url }]] });
      else await send(button.text || "Havola hali qo'shilmagan.", menu());
      return;
    }
    await send(button.text || "Ma'lumot tez orada qo'shiladi.", menu());
    return;
  }

  // AI yordamchi: erkin savolga katalog asosida javob (soatiga 20 tagacha)
  if (text && !text.startsWith("/") && cfg.aiBot) {
    const { turns, aiLastHour } = await recentHistory(db, bot.project_id, chatId);
    const logged = await logIncoming(db, bot, chatId, who, text);
    if (aiLastHour < 20) {
      try {
        await tg(bot.token, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => undefined);
        const answer = await answerCustomer(db, bot.workspace_id, { history: turns, question: text, channel: "telegram", instructions: cfg.aiInstructions });
        await send(answer, menu());
        if (logged) await logAiReply(db, bot, chatId, answer);
        return;
      } catch (err) {
        console.error("AI javob bermadi:", err instanceof Error ? err.message : "xato");
      }
    }
    await send(logged ? "✉️ Xabaringiz yetkazildi, tez orada javob beramiz." : "Iltimos, quyidagi menyudan tanlang 👇", menu());
    return;
  }

  // Menyuda yo'q erkin matn — do'konga xabar sifatida saqlanadi (Chat bo'limi)
  if (text && !text.startsWith("/") && (await logIncoming(db, bot, chatId, who, text))) {
    await send("✉️ Xabaringiz yetkazildi, tez orada javob beramiz.", menu());
    return;
  }
  await send("Iltimos, quyidagi menyudan tanlang 👇", menu());
}
