import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pastki menyudagi (reply keyboard) Mini App tugmasi Telegram initData bermaydi.
 * Shuning uchun bot har bir chat uchun sayt manziliga imzolangan parametr qo'shadi:
 *   ?tgb=<botProjectId>&tgc=<chatId>.<imzo>
 * Server buyurtma kelganda imzoni tekshirib, mijozning Telegram chatini aniqlaydi.
 */

function signingKey() {
  const raw = process.env.BOT_TOKEN_KEY;
  if (!raw) throw new Error("BOT_TOKEN_KEY o'rnatilmagan");
  return createHmac("sha256", Buffer.from(raw, "base64")).update("tezdokon:chat-link:v1").digest();
}

function sig(botProjectId: string, chatId: number) {
  return createHmac("sha256", signingKey()).update(`${botProjectId}:${chatId}`).digest("base64url").slice(0, 22);
}

export function chatLinkParams(botProjectId: string, chatId: number) {
  return { tgb: botProjectId, tgc: `${chatId}.${sig(botProjectId, chatId)}` };
}

export function withChatLink(url: string, botProjectId: string, chatId: number): string {
  try {
    const u = new URL(url);
    const p = chatLinkParams(botProjectId, chatId);
    u.searchParams.set("tgb", p.tgb);
    u.searchParams.set("tgc", p.tgc);
    return u.toString();
  } catch {
    return url;
  }
}

export function verifyChatLink(botProjectId: string, tgc: string): number | null {
  const m = /^(\d{1,16})\.([A-Za-z0-9_-]{22})$/.exec(tgc);
  if (!m || !/^[0-9a-f-]{36}$/i.test(botProjectId)) return null;
  const chatId = Number(m[1]);
  try {
    const expected = Buffer.from(sig(botProjectId, chatId));
    const given = Buffer.from(m[2]);
    return expected.length === given.length && timingSafeEqual(expected, given) ? chatId : null;
  } catch {
    return null;
  }
}
