import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";
import { verifyChatLink } from "@/lib/telegram/chat-link";
import { verifyInitData } from "@/lib/telegram/webapp";
import { verifySession } from "./customer-session";

/** Saytdagi mijozni Telegram orqali aniqlash: Mini App initData, bot havolasi (?tgb&tgc) yoki kabinet sessiyasi */
export async function identifyTelegramCustomer(
  db: SupabaseClient,
  workspaceId: string,
  input: { initData?: string; tgLink?: { bot: string; chat: string } | null; session?: string },
): Promise<{ chatId: number; botProjectId: string } | null> {
  if (input.initData) {
    const { data: bots } = await db.from("bots").select("project_id, token_encrypted").eq("workspace_id", workspaceId);
    for (const b of bots ?? []) {
      try {
        const u = verifyInitData(input.initData, decryptSecret(b.token_encrypted as string));
        if (u) return { chatId: u.id, botProjectId: b.project_id as string };
      } catch {
        // keyingi bot
      }
    }
  }
  if (input.tgLink) {
    const chatId = verifyChatLink(input.tgLink.bot, input.tgLink.chat);
    if (chatId) {
      const { data: b } = await db.from("bots").select("project_id").eq("project_id", input.tgLink.bot).eq("workspace_id", workspaceId).maybeSingle();
      if (b) return { chatId, botProjectId: b.project_id as string };
    }
  }
  if (input.session) {
    const s = verifySession(input.session, workspaceId);
    if (s?.b && s.c) return { chatId: s.c, botProjectId: s.b };
  }
  return null;
}

/** Saqlangan savatni bot obunachisi holatiga yozadi (bo'sh bo'lsa o'chiradi) */
export async function storeCart(db: SupabaseClient, botProjectId: string, chatId: number, cart: { items: { id: string; qty: number }[]; slug: string } | null) {
  const { data } = await db.from("bot_subscribers").select("state").eq("project_id", botProjectId).eq("chat_id", chatId).maybeSingle();
  if (!data) return;
  const state = { ...((data.state as Record<string, unknown> | null) ?? {}) };
  if (cart && cart.items.length) state.cart = { ...cart, at: Date.now(), reminded: false };
  else delete state.cart;
  await db.from("bot_subscribers").update({ state }).eq("project_id", botProjectId).eq("chat_id", chatId);
}
