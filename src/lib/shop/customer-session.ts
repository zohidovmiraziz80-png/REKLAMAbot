import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Saytdagi mijoz sessiyasi: imzolangan token (brauzer localStorage'da saqlaydi).
 *   base64url(json).imzo
 * Telefon Telegram orqali tasdiqlangan bo'ladi, shuning uchun token ichidagi raqamga ishonsa bo'ladi.
 */

export type CustomerSession = {
  /** workspace id */
  w: string;
  /** tasdiqlangan telefon */
  p: string;
  /** Telegram chat id */
  c: number;
  /** bot project id */
  b: string | null;
  /** ism */
  n: string;
  /** amal qilish muddati (sekund) */
  e: number;
};

const TTL_SECONDS = 60 * 60 * 24 * 90;

function key() {
  const raw = process.env.BOT_TOKEN_KEY;
  if (!raw) throw new Error("BOT_TOKEN_KEY o'rnatilmagan");
  return createHmac("sha256", Buffer.from(raw, "base64")).update("mixbot:customer-session:v1").digest();
}

const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

export function newLoginToken() {
  return randomBytes(12).toString("hex");
}

export function createSession(s: Omit<CustomerSession, "e">): string {
  const payload = Buffer.from(JSON.stringify({ ...s, e: Math.floor(Date.now() / 1000) + TTL_SECONDS }), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | null | undefined, workspaceId: string): CustomerSession | null {
  if (!token || token.length > 1200) return null;
  const [payload, given] = token.split(".");
  if (!payload || !given) return null;
  try {
    const a = Buffer.from(sign(payload));
    const b = Buffer.from(given);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CustomerSession;
    if (s.w !== workspaceId || typeof s.p !== "string" || s.e < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}
