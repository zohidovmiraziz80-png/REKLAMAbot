import type { SupabaseClient } from "@supabase/supabase-js";
import { tg } from "./api";
import { loadMainBot, shopUrl } from "./main-bot";

/** Mahsulot yoki aksiya postini do'kon kanaliga chiqaradi */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n: number) => `${Number(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;

export class PostError extends Error {}

async function channel(db: SupabaseClient, workspaceId: string) {
  const bot = await loadMainBot(db, workspaceId);
  if (!bot) throw new PostError("Telegram bot ulanmagan");
  if (!bot.config.postChannelId) throw new PostError("Kanal ulanmagan. Marketing → Telegram kanal bo'limidagi ko'rsatma bo'yicha ulang.");
  return { bot, chatId: bot.config.postChannelId };
}

async function send(token: string, chatId: number, caption: string, imageUrl: string | null, button: { text: string; url: string } | null) {
  const reply_markup = button ? { inline_keyboard: [[button]] } : undefined;
  try {
    if (imageUrl) {
      await tg(token, "sendPhoto", { chat_id: chatId, photo: imageUrl, caption: caption.slice(0, 1024), parse_mode: "HTML", ...(reply_markup ? { reply_markup } : {}) });
    } else {
      await tg(token, "sendMessage", { chat_id: chatId, text: caption.slice(0, 4096), parse_mode: "HTML", ...(reply_markup ? { reply_markup } : {}) });
    }
  } catch (err) {
    // Rasm yuklanmasa — matn bilan
    if (imageUrl) return send(token, chatId, caption, null, button);
    throw new PostError(err instanceof Error && /not enough rights|chat not found|kicked/i.test(err.message) ? "Bot kanalda administrator emas yoki kanaldan chiqarilgan" : "Kanalga yuborilmadi");
  }
}

export async function postProduct(db: SupabaseClient, workspaceId: string, productId: string) {
  const { bot, chatId } = await channel(db, workspaceId);
  const { data: p } = await db.from("products").select("name, description, price, old_price, image_url, stock").eq("id", productId).eq("workspace_id", workspaceId).maybeSingle();
  if (!p) throw new PostError("Mahsulot topilmadi");
  const price = p.old_price && Number(p.old_price) > Number(p.price) ? `<s>${money(Number(p.old_price))}</s> → <b>${money(Number(p.price))}</b> 🔥` : `<b>${money(Number(p.price))}</b>`;
  const caption = [`🛍 <b>${esc(p.name as string)}</b>`, "", p.description ? esc(String(p.description).slice(0, 600)) : "", "", `💰 ${price}`, p.stock === 0 ? "⏳ Hozircha tugagan" : ""]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n")
    .trim();
  const url = await shopUrl(db, workspaceId, bot.config);
  await send(bot.token, chatId, caption, (p.image_url as string | null) ?? null, url ? { text: "🛒 Buyurtma berish", url } : null);
}

export async function postCustom(db: SupabaseClient, workspaceId: string, input: { text: string; imageUrl?: string; buttonText?: string; buttonUrl?: string }) {
  const { bot, chatId } = await channel(db, workspaceId);
  const url = input.buttonUrl && /^https:\/\//.test(input.buttonUrl) ? input.buttonUrl : await shopUrl(db, workspaceId, bot.config);
  const image = input.imageUrl && /^https:\/\//.test(input.imageUrl) ? input.imageUrl : null;
  await send(bot.token, chatId, esc(input.text), image, url ? { text: input.buttonText || "🛒 Do'konni ochish", url } : null);
}
