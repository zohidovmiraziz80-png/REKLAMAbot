import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Maxfiy qiymatlarni (bot tokenlari, API kalitlar) bazada shifrlab saqlash uchun.
 * Kalit: BOT_TOKEN_KEY — 32 bayt, base64 ko'rinishida (faqat serverda, Vercel'da "Sensitive").
 * Format: v1:<iv>:<tag>:<shifrlangan matn> (hammasi base64)
 */

function key() {
  const raw = process.env.BOT_TOKEN_KEY;
  if (!raw) throw new Error("BOT_TOKEN_KEY o'rnatilmagan");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("BOT_TOKEN_KEY 32 bayt (base64) bo'lishi kerak");
  return k;
}

export function isEncryptionConfigured() {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(payload: string) {
  const [version, iv, tag, ct] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Shifrlangan qiymat formati noto'g'ri");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("hex");
}

/** Vaqtga bog'liq hujumlardan himoyalangan solishtirish */
export function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}
