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
