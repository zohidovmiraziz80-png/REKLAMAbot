/**
 * Do'kon uchun umumiy yordamchilar (server va brauzerda). Intl ishlatilmaydi — hydration farqi bo'lmasin.
 */

export function formatMoney(n: number | null | undefined) {
  const v = Math.round(Number(n ?? 0));
  return `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;
}

/** UTC vaqtni Toshkent (UTC+5) bo'yicha "dd.mm.yyyy hh:mm" ko'rinishiga */
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export const ORDER_STATUSES = ["new", "confirmed", "delivering", "done", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Yangi",
  confirmed: "Qabul qilindi",
  delivering: "Yetkazilmoqda",
  done: "Yakunlandi",
  cancelled: "Bekor qilindi",
};

export const ORDER_STATUS_EMOJI: Record<OrderStatus, string> = {
  new: "🆕",
  confirmed: "✅",
  delivering: "🚚",
  done: "🎉",
  cancelled: "❌",
};

/** Mijozga ko'rinadigan holat nomlari */
export const CUSTOMER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "⏳ Qabul qilinishi kutilmoqda",
  confirmed: "✅ Do'kon qabul qildi",
  delivering: "🚚 Yo'lda",
  done: "🎉 Yetkazildi",
  cancelled: "❌ Bekor qilindi",
};

export const PAY_METHOD_LABELS: Record<string, string> = { cash: "Naqd (qabul qilganda)", card: "Kartaga o'tkazma", payme: "Payme", click: "Click", multicard: "Multicard" };

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "To'lanmagan",
  paid: "To'langan",
  refunded: "Qaytarilgan",
};

export const DELIVERY_LABELS = { pickup: "Olib ketish", courier: "Yetkazib berish" } as const;
export const SOURCE_LABELS = { site: "Sayt", miniapp: "Telegram Mini App", bot: "Bot", manual: "Qo'lda" } as const;

export type OrderItem = { product_id: string; name: string; price: number; qty: number; image_url?: string | null; emoji?: string };
