import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUzPhone, normalizeUzPhone } from "@/lib/phone";
import { ORDER_STATUSES, ORDER_STATUS_EMOJI, ORDER_STATUS_LABELS, formatMoney, type OrderStatus } from "@/lib/shop/format";
import { ORDER_COLUMNS, notifyCustomerStatus, orderAdminKeyboard, orderAdminText, type OrderRow } from "@/lib/shop/notify";
import { tg } from "./api";
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
  contact?: { phone_number: string; user_id?: number };
};
type TgCallback = {
  id: string;
  from: TgUser;
  data?: string;
  message?: { message_id: number; chat: { id: number; type: string } };
};
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallback };

export type BotRuntime = {
  project_id: string;
  workspace_id: string;
  owner_link_code: string;
  owner_chat_id: number | null;
  config: unknown;
  token: string;
};

type ChatState = { step?: "phone" | "message"; phone?: string };

const CANCEL = "❌ Bekor qilish";
const SHARE_PHONE = "📱 Raqamni yuborish";

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
  const m = (cb.data ?? "").match(/^os:([0-9a-f-]{36}):(\w+)$/);
  const chatId = cb.message?.chat.id;
  if (!m || !chatId || !cb.message) return answer("");
  const status = m[2] as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return answer("");

  // Ruxsat: bot egasining chati yoki shu bot orqali ulangan do'kon guruhi
  let allowed = bot.owner_chat_id === chatId;
  if (!allowed) {
    const { data: s } = await db.from("shop_settings").select("group_chat_id, group_bot_project_id").eq("workspace_id", bot.workspace_id).maybeSingle();
    allowed = !!s && s.group_chat_id === chatId && s.group_bot_project_id === bot.project_id;
  }
  if (!allowed) return answer("Ruxsat yo'q");

  const { data: order } = await db.from("orders").select(ORDER_COLUMNS).eq("id", m[1]).eq("workspace_id", bot.workspace_id).maybeSingle();
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
  const who = [cb.from.first_name, cb.from.username ? `@${cb.from.username}` : ""].filter(Boolean).join(" ");
  await tg(bot.token, "editMessageText", {
    chat_id: chatId,
    message_id: cb.message.message_id,
    text: `${orderAdminText(o, current)}\n\n✏️ ${ORDER_STATUS_LABELS[current]} — ${who}`.slice(0, 4096),
    reply_markup: orderAdminKeyboard(o, current),
  }).catch(() => undefined);
}

/** Guruhda: "/ulash KOD" — buyurtmalar shu guruhga tushadigan bo'ladi */
async function handleGroupMessage(db: SupabaseClient, bot: BotRuntime, msg: TgMessage) {
  const text = (msg.text ?? "").trim();
  const mm = text.match(/^\/ulash(?:@\w+)?\s+([a-z0-9]{6,32})$/i);
  if (!mm) return;
  const { data: s } = await db.from("shop_settings").select("group_link_code").eq("workspace_id", bot.workspace_id).maybeSingle();
  if (!s || s.group_link_code !== mm[1].toLowerCase()) {
    await tg(bot.token, "sendMessage", { chat_id: msg.chat.id, text: "❌ Kod noto'g'ri. Kodni TezDo'kon → Buyurtmalar → Sozlamalar sahifasidan oling." }).catch(() => undefined);
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
  const menu = () => menuKeyboard(cfg, link);
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
  const setState = async (s: ChatState) => {
    await db.from("bot_subscribers").update({ state: s }).eq("project_id", bot.project_id).eq("chat_id", chatId);
  };

  // /start va administratorni ulash
  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1] ?? "";
    await setState({});
    if (payload && payload === `owner_${bot.owner_link_code}`) {
      await db.from("bots").update({ owner_chat_id: chatId }).eq("project_id", bot.project_id);
      await send("✅ Siz bu botning administratori sifatida ulandingiz. Yangi buyurtma va arizalar shu chatga keladi.", menu());
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
          .select("number, status, total, items, created_at")
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
      const entries = [
        ...(orders ?? []).map((o) => {
          const st = o.status as OrderStatus;
          const items = ((o.items as { name: string; qty: number }[]) ?? []).map((i) => `${i.name} × ${i.qty}`).join(", ");
          return {
            at: o.created_at as string,
            text: `🛒 №${o.number} · ${dateOf(o.created_at as string)} · ${ORDER_STATUS_EMOJI[st]} ${ORDER_STATUS_LABELS[st]}\n${items.slice(0, 160)}\n💰 ${formatMoney(o.total as number)}`,
          };
        }),
        ...(requests ?? []).map((r) => ({
          at: r.created_at as string,
          text: `📝 Ariza №${r.id} · ${dateOf(r.created_at as string)} · ${reqLabel[r.status as string] ?? r.status}\n${String(r.message).slice(0, 120)}`,
        })),
      ]
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 6);
      await send(`📦 Oxirgi buyurtmalaringiz:\n\n${entries.map((e) => e.text).join("\n\n")}`, menu());
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

  await send("Iltimos, quyidagi menyudan tanlang 👇", menu());
}
