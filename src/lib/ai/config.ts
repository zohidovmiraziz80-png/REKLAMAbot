/**
 * AI funksiyalari hozircha o'chirilgan (xarajatni nazorat qilish uchun).
 * Yoqish: Vercel'da AI_ENABLED=true muhit o'zgaruvchisini qo'shing.
 * Keyinchalik bu tarif (billing) bo'yicha workspace darajasida boshqariladi.
 */
export function isAiEnabled() {
  return process.env.AI_ENABLED === "true";
}
