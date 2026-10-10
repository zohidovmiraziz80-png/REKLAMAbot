import { after } from "next/server";
import { maybeAutoSyncBito } from "@/lib/integrations/bito-sync";
import { enabledPayMethods } from "@/lib/payments/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShopData } from "./types";

/**
 * Ommaviy sayt uchun do'kon ma'lumotlari: faqat faol mahsulotlar va mijozga kerakli sozlamalar.
 * Service role bilan o'qiladi, lekin faqat xavfsiz ustunlar tashqariga chiqadi.
 */
export async function loadShopData(workspaceId: string, slug: string, opts: { preview?: boolean } = {}): Promise<ShopData | null> {
  let db;
  try {
    db = createAdminClient();
  } catch {
    return null;
  }
  const loadProducts = async () => {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; from < 3000; from += 1000) {
      const { data } = await db
        .from("products")
        .select("id, name, description, price, old_price, category, image_url, emoji, stock")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("sort", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + 999);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const BASE_COLS = "accept_orders, pickup_enabled, pickup_address, delivery_enabled, delivery_price, free_delivery_from, min_order, cash_enabled";
  type SettingsRow = {
    accept_orders: boolean;
    pickup_enabled: boolean;
    pickup_address: string;
    delivery_enabled: boolean;
    delivery_price: number;
    free_delivery_from: number | null;
    min_order: number;
    cash_enabled: boolean;
    card_enabled?: boolean;
    card_number?: string;
  };
  const loadSettings = async (): Promise<SettingsRow | null> => {
    const r = await db.from("shop_settings").select(`${BASE_COLS}, card_enabled, card_number`).eq("workspace_id", workspaceId).maybeSingle();
    if (!r.error) return r.data as unknown as SettingsRow | null;
    // Karta ustunlari hali bazada bo'lmasa
    const legacy = await db.from("shop_settings").select(BASE_COLS).eq("workspace_id", workspaceId).maybeSingle();
    return legacy.data as unknown as SettingsRow | null;
  };
  const [products, s, payMethods, { count: botCount }] = await Promise.all([
    loadProducts(),
    loadSettings(),
    enabledPayMethods(db, workspaceId),
    db.from("bots").select("project_id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);
  const cardEnabled = !!(s?.card_enabled && s.card_number);

  // Bito ulangan bo'lsa — narx va qoldiq 3 soatdan eski bo'lsa, javobdan keyin fonda yangilanadi
  if (!opts.preview) {
    try {
      after(() => maybeAutoSyncBito(db, workspaceId));
    } catch {
      // after() faqat so'rov ichida ishlaydi
    }
  }

  return {
    slug,
    preview: !!opts.preview,
    products: (products ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      description: (p.description as string) ?? "",
      price: Number(p.price),
      oldPrice: p.old_price === null ? null : Number(p.old_price),
      category: (p.category as string) ?? "",
      imageUrl: (p.image_url as string | null) ?? null,
      emoji: (p.emoji as string) ?? "",
      inStock: p.stock === null || Number(p.stock) > 0,
      maxQty: p.stock === null ? 99 : Math.min(99, Number(p.stock)),
    })),
    settings: {
      acceptOrders: s?.accept_orders ?? true,
      pickupEnabled: s?.pickup_enabled ?? true,
      pickupAddress: (s?.pickup_address as string) ?? "",
      deliveryEnabled: s?.delivery_enabled ?? true,
      deliveryPrice: Number(s?.delivery_price ?? 0),
      freeDeliveryFrom: s?.free_delivery_from == null ? null : Number(s.free_delivery_from),
      minOrder: Number(s?.min_order ?? 0),
      cashEnabled: s?.cash_enabled !== false || (payMethods.length === 0 && !cardEnabled),
      cardEnabled,
      payMethods,
      loginEnabled: (botCount ?? 0) > 0,
    },
  };
}
