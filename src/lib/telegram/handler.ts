import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUzPhone, normalizeUzPhone } from "@/lib/phone";
import { tg } from "./api";
import { botConfigSchema, safeBotUrl, safeWebAppUrl, type BotConfig } from "./config";

/**
 * Telegram'dan kelgan har bir xabarni qayta ishlaydi:
 * /start → salom + menyu; menyu tugmalari → javob; ariza oqimi → telefon → xabar → saqlash + egaga xabar.
 */

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };
type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  contact?: { phone_number: string; user_id?: number };
};
export type TgUpdate = { update_id: number; message?: TgMessage };

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

function menuKeyboard(cfg: BotConfig) {
  if (!cfg.buttons.length) return { remove_keyboard: true };
  const rows: { text: string; web_app?: { url: string } }[][] = [];
  for (let i = 0; i < cfg.buttons.length; i += 2) {
    rows.push(
      cfg.buttons.slice(i, i + 2).map((b) => {
        const url = b.type === "webapp" ? safeWebAppUrl(b.url || cfg.siteUrl) : null;
        return url ? { text: b.label, web_app: { url } } : { text: b.label };
      }),
    );
  }
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

export async function handleUpdate(db: SupabaseClient, bot: BotRuntime, update: TgUpdate) {
  const msg = update.message;
  if (!msg || msg.chat.type !== "private") return;

  const chatId = msg.chat.id;
  const cfg = botConfigSchema.parse(bot.config ?? {});
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
      await send("✅ Siz bu botning administratori sifatida ulandingiz. Yangi arizalar shu chatga keladi.", menuKeyboard(cfg));
      return;
    }
    await send(cfg.welcome, menuKeyboard(cfg));
    const siteUrl = safeWebAppUrl(cfg.siteUrl);
    if (siteUrl) {
      await send("👇 Do'konimizni Telegram ichida oching", {
        inline_keyboard: [[{ text: `🛍 ${cfg.menuButtonText || "Do'kon"}`, web_app: { url: siteUrl } }]],
      });
    }
    return;
  }

  if (text === CANCEL) {
    await setState({});
    await send("Bekor qilindi.", menuKeyboard(cfg));
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
    await send(cfg.requestThanks, menuKeyboard(cfg));

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
    if (button.type === "webapp") {
      // Mini App tugmasi odatda to'g'ridan-to'g'ri saytni ochadi; bu yerga faqat manzil noto'g'ri bo'lsa keladi
      const url = safeWebAppUrl(button.url || cfg.siteUrl);
      if (url) await send("👇 Saytni ochish", { inline_keyboard: [[{ text: button.label, web_app: { url } }]] });
      else await send("Sayt hali ulanmagan.", menuKeyboard(cfg));
      return;
    }
    if (button.type === "link") {
      const url = safeBotUrl(button.url);
      if (url) await send(button.text || button.label, { inline_keyboard: [[{ text: "Ochish ↗", url }]] });
      else await send(button.text || "Havola hali qo'shilmagan.", menuKeyboard(cfg));
      return;
    }
    await send(button.text || "Ma'lumot tez orada qo'shiladi.", menuKeyboard(cfg));
    return;
  }

  await send("Iltimos, quyidagi menyudan tanlang 👇", menuKeyboard(cfg));
}
