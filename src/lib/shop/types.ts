/** Ommaviy saytdagi do'kon (katalog va savat) uchun ma'lumot turlari */

export type PublicProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  category: string;
  imageUrl: string | null;
  emoji: string;
  inStock: boolean;
  maxQty: number;
};

export type PublicShopSettings = {
  acceptOrders: boolean;
  pickupEnabled: boolean;
  pickupAddress: string;
  deliveryEnabled: boolean;
  deliveryPrice: number;
  freeDeliveryFrom: number | null;
  minOrder: number;
  /** Naqd (qabul qilganda) to'lov yoqilganmi */
  cashEnabled: boolean;
  /** Kartaga o'tkazma (kanal SMS orqali avto-tasdiqlash) */
  cardEnabled: boolean;
  /** Mijoz kabineti (Telegram orqali kirish) — do'konda bot ulangan bo'lsa */
  loginEnabled: boolean;
  /** "Bot" tarifi: sayt faqat Telegram Mini App ichida ochiladi */
  telegramOnly: boolean;
  /** Do'konning asosiy boti (havola uchun) */
  botUsername: string | null;
  /** Ulangan onlayn to'lov usullari */
  payMethods: ("payme" | "click" | "multicard")[];
};

export type ShopData = {
  slug: string;
  /** Ko'rib chiqish rejimi — buyurtma yuborilmaydi */
  preview: boolean;
  /** Tahrirlovchi ichida — savat oynasi va suzuvchi tugma ko'rsatilmaydi */
  embedded?: boolean;
  products: PublicProduct[];
  settings: PublicShopSettings;
};
