import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderItem, type OrderStatus, type PaymentStatus } from "@/lib/shop/format";
import { notifyCustomerStatus } from "@/lib/shop/notify";
import { ActionError, defineAction } from "./define";

/**
 * Do'kon: mahsulotlar, buyurtmalar, mijozlar va sozlamalar.
 * Hammasi foydalanuvchi sessiyasi + RLS orqali; faqat Telegram xabarlari service role bilan.
 */

// ===== Mahsulotlar =====

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  old_price: number | null;
  category: string;
  image_url: string | null;
  emoji: string;
  sku: string | null;
  stock: number | null;
  is_active: boolean;
  sort: number;
  external_source: string | null;
  created_at: string;
};

const PRODUCT_COLUMNS = "id, name, description, price, old_price, category, image_url, emoji, sku, stock, is_active, sort, external_source, created_at";

export const listProducts = defineAction({
  name: "listProducts",
  description: "Workspace'dagi barcha mahsulotlar ro'yxati (nomi, narxi, qoldiq, kategoriya).",
  input: z.object({}),
  handler: async (ctx): Promise<Product[]> => {
    // Supabase bir so'rovda ko'pi bilan 1000 qator qaytaradi — sahifalab olamiz (Bito'dan minglab mahsulot bo'lishi mumkin)
    const all: Product[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await ctx.supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("workspace_id", ctx.workspaceId)
        .order("sort", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (error) throw new ActionError("internal", "Mahsulotlarni yuklab bo'lmadi");
      all.push(...((data ?? []) as Product[]));
      if (!data || data.length < 1000) break;
    }
    return all;
  },
});

const money = z.coerce.number().int("Butun son kiriting").min(0, "Manfiy bo'lmasin").max(1_000_000_000_000);

const productInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nomini kiriting").max(120),
  description: z.string().trim().max(2000).default(""),
  price: money,
  oldPrice: money.nullable().default(null),
  category: z.string().trim().max(60).default(""),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//.test(v), "Rasm manzili https bilan boshlansin")
    .nullable()
    .default(null),
  emoji: z.string().trim().max(8).default(""),
  sku: z.string().trim().max(64).nullable().default(null),
  stock: z.coerce.number().int().min(0).max(10_000_000).nullable().default(null),
  isActive: z.boolean().default(true),
});

export const saveProduct = defineAction({
  name: "saveProduct",
  description: "Mahsulot qo'shadi yoki (id berilsa) tahrirlaydi: nomi, narxi (so'm), eski narx, tavsif, kategoriya, rasm, qoldiq, faolligi.",
  input: productInput,
  handler: async (ctx, input): Promise<Product> => {
    const row = {
      name: input.name,
      description: input.description,
      price: input.price,
      old_price: input.oldPrice && input.oldPrice > input.price ? input.oldPrice : null,
      category: input.category,
      image_url: input.imageUrl || null,
      emoji: input.emoji,
      sku: input.sku || null,
      stock: input.stock,
      is_active: input.isActive,
    };
    const { data, error } = input.id
      ? await ctx.supabase.from("products").update(row).eq("id", input.id).eq("workspace_id", ctx.workspaceId).select(PRODUCT_COLUMNS).maybeSingle()
      : await ctx.supabase.from("products").insert({ ...row, workspace_id: ctx.workspaceId }).select(PRODUCT_COLUMNS).maybeSingle();
    if (error) throw new ActionError("internal", "Mahsulot saqlanmadi");
    if (!data) throw new ActionError("not_found", "Mahsulot topilmadi");
    return data as Product;
  },
});

export const setProductActive = defineAction({
  name: "setProductActive",
  description: "Mahsulotni sotuvga chiqaradi yoki yashiradi.",
  input: z.object({ id: z.string().uuid(), isActive: z.boolean() }),
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("products")
      .update({ is_active: input.isActive })
      .eq("id", input.id)
      .eq("workspace_id", ctx.workspaceId)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new ActionError("not_found", "Mahsulot topilmadi");
    return { id: input.id, isActive: input.isActive };
  },
});

export const deleteProduct = defineAction({
  name: "deleteProduct",
  description: "Mahsulotni butunlay o'chiradi (eski buyurtmalarda nomi saqlanib qoladi).",
  input: z.object({ id: z.string().uuid() }),
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("products")
      .delete()
      .eq("id", input.id)
      .eq("workspace_id", ctx.workspaceId)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new ActionError("not_found", "Mahsulot topilmadi");
    return { id: input.id };
  },
});

// ===== Buyurtmalar =====

export type Order = {
  id: string;
  number: number;
  source: "site" | "miniapp" | "bot" | "manual";
  customer_id: string | null;
  customer_name: string | null;
  phone: string;
  address: string | null;
  comment: string | null;
  delivery_method: "pickup" | "courier";
  payment_method: string;
  payment_status: PaymentStatus;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  delivery_price: number;
  total: number;
  admin_note: string;
  chat_id: number | null;
  external_ids: Record<string, string>;
  sync_error: string | null;
  created_at: string;
};

const ORDER_COLUMNS =
  "id, number, source, customer_id, customer_name, phone, address, comment, delivery_method, payment_method, payment_status, status, items, subtotal, delivery_price, total, admin_note, chat_id, external_ids, sync_error, created_at";

export const listOrders = defineAction({
  name: "listOrders",
  description: "Buyurtmalar ro'yxati (eng yangisi birinchi). Holat bo'yicha filtrlash mumkin: new, confirmed, delivering, done, cancelled.",
  input: z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    customerId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(500).default(200),
  }),
  handler: async (ctx, input): Promise<{ orders: Order[]; counts: Record<OrderStatus | "all", number> }> => {
    let q = ctx.supabase.from("orders").select(ORDER_COLUMNS).eq("workspace_id", ctx.workspaceId);
    if (input.status) q = q.eq("status", input.status);
    if (input.customerId) q = q.eq("customer_id", input.customerId);
    const [{ data, error }, { data: all }] = await Promise.all([
      q.order("created_at", { ascending: false }).limit(input.limit),
      ctx.supabase.from("orders").select("status").eq("workspace_id", ctx.workspaceId).limit(10000),
    ]);
    if (error) throw new ActionError("internal", "Buyurtmalarni yuklab bo'lmadi");
    const counts = { all: 0, new: 0, confirmed: 0, delivering: 0, done: 0, cancelled: 0 } as Record<OrderStatus | "all", number>;
    for (const o of all ?? []) {
      counts.all++;
      counts[o.status as OrderStatus]++;
    }
    return { orders: (data ?? []) as Order[], counts };
  },
});

export const updateOrder = defineAction({
  name: "updateOrder",
  description: "Buyurtma holatini (status), to'lov holatini yoki ichki izohni o'zgartiradi. Holat o'zgarsa mijozga Telegram orqali xabar boradi.",
  input: z.object({
    id: z.string().uuid(),
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    adminNote: z.string().max(2000).optional(),
  }),
  handler: async (ctx, input) => {
    const { data: before } = await ctx.supabase
      .from("orders")
      .select("status, number, chat_id, bot_project_id, workspace_id")
      .eq("id", input.id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!before) throw new ActionError("not_found", "Buyurtma topilmadi");
    if (before.status === "cancelled" && input.status && input.status !== "cancelled") {
      throw new ActionError("validation", "Bekor qilingan buyurtmani qayta ochib bo'lmaydi");
    }

    const patch: Record<string, unknown> = {};
    if (input.status) patch.status = input.status;
    if (input.paymentStatus) patch.payment_status = input.paymentStatus;
    if (input.adminNote !== undefined) patch.admin_note = input.adminNote;
    if (!Object.keys(patch).length) return { id: input.id };

    const { error } = await ctx.supabase.from("orders").update(patch).eq("id", input.id).eq("workspace_id", ctx.workspaceId);
    if (error) throw new ActionError("internal", "Saqlanmadi");

    if (input.status && input.status !== before.status) {
      try {
        await notifyCustomerStatus(
          createAdminClient(),
          {
            workspace_id: before.workspace_id as string,
            number: before.number as number,
            chat_id: (before.chat_id as number | null) ?? null,
            bot_project_id: (before.bot_project_id as string | null) ?? null,
          },
          input.status,
        );
      } catch {
        // xabar yuborilmasa ham holat saqlangan
      }
    }
    return { id: input.id };
  },
});

// ===== Mijozlar =====

export type Customer = {
  id: string;
  name: string | null;
  phone: string;
  telegram_username: string | null;
  telegram_chat_id: number | null;
  address: string | null;
  note: string;
  orders_count: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
};

export const listCustomers = defineAction({
  name: "listCustomers",
  description: "Mijozlar bazasi: ismi, telefoni, buyurtmalar soni va jami xarid summasi. Ism yoki telefon bo'yicha qidirish mumkin.",
  input: z.object({ query: z.string().max(60).default("") }),
  handler: async (ctx, input): Promise<Customer[]> => {
    let q = ctx.supabase
      .from("customers")
      .select("id, name, phone, telegram_username, telegram_chat_id, address, note, orders_count, total_spent, last_order_at, created_at")
      .eq("workspace_id", ctx.workspaceId);
    // Filtr sintaksisini buzadigan belgilarni olib tashlaymiz
    const term = input.query.replace(/[%,()*\\.:"'_]/g, "").trim();
    if (term) {
      const digits = term.replace(/\D/g, "");
      q = digits.length >= 3 ? q.or(`name.ilike.%${term}%,phone.ilike.%${digits}%`) : q.ilike("name", `%${term}%`);
    }
    const { data, error } = await q.order("last_order_at", { ascending: false, nullsFirst: false }).limit(500);
    if (error) throw new ActionError("internal", "Mijozlarni yuklab bo'lmadi");
    return (data ?? []) as Customer[];
  },
});

export const updateCustomer = defineAction({
  name: "updateCustomer",
  description: "Mijoz ismi, manzili yoki izohini o'zgartiradi.",
  input: z.object({
    id: z.string().uuid(),
    name: z.string().trim().max(120).optional(),
    address: z.string().trim().max(300).optional(),
    note: z.string().max(2000).optional(),
  }),
  handler: async (ctx, input) => {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name || null;
    if (input.address !== undefined) patch.address = input.address || null;
    if (input.note !== undefined) patch.note = input.note;
    const { data, error } = await ctx.supabase
      .from("customers")
      .update(patch)
      .eq("id", input.id)
      .eq("workspace_id", ctx.workspaceId)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new ActionError("not_found", "Mijoz topilmadi");
    return { id: input.id };
  },
});

// ===== Do'kon sozlamalari =====

export type ShopSettings = {
  accept_orders: boolean;
  pickup_enabled: boolean;
  pickup_address: string;
  delivery_enabled: boolean;
  delivery_price: number;
  free_delivery_from: number | null;
  min_order: number;
  order_thanks: string;
  group_link_code: string | null;
  group_chat_id: number | null;
  group_title: string | null;
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  accept_orders: true,
  pickup_enabled: true,
  pickup_address: "",
  delivery_enabled: true,
  delivery_price: 0,
  free_delivery_from: null,
  min_order: 0,
  order_thanks: "",
  group_link_code: null,
  group_chat_id: null,
  group_title: null,
};

export const getShopSettings = defineAction({
  name: "getShopSettings",
  description: "Do'kon sozlamalari: buyurtma qabul qilish, olib ketish/yetkazish, yetkazish narxi, minimal buyurtma, Telegram guruh.",
  input: z.object({}),
  handler: async (ctx): Promise<{ settings: ShopSettings; bots: { username: string }[] }> => {
    let { data } = await ctx.supabase
      .from("shop_settings")
      .select("accept_orders, pickup_enabled, pickup_address, delivery_enabled, delivery_price, free_delivery_from, min_order, order_thanks, group_link_code, group_chat_id, group_title")
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!data) {
      // Birinchi marta — standart sozlamalar bilan yaratamiz (guruh kodi bazada hosil bo'ladi)
      await ctx.supabase.from("shop_settings").insert({ workspace_id: ctx.workspaceId });
      ({ data } = await ctx.supabase
        .from("shop_settings")
        .select("accept_orders, pickup_enabled, pickup_address, delivery_enabled, delivery_price, free_delivery_from, min_order, order_thanks, group_link_code, group_chat_id, group_title")
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle());
    }
    const { data: bots } = await ctx.supabase.from("bots").select("username").eq("workspace_id", ctx.workspaceId);
    return { settings: (data as ShopSettings | null) ?? DEFAULT_SHOP_SETTINGS, bots: (bots ?? []) as { username: string }[] };
  },
});

export const saveShopSettings = defineAction({
  name: "saveShopSettings",
  description: "Do'kon sozlamalarini saqlaydi: buyurtma qabul qilish, olib ketish manzili, yetkazish narxi, bepul yetkazish chegarasi, minimal buyurtma, rahmat matni.",
  input: z
    .object({
      acceptOrders: z.boolean(),
      pickupEnabled: z.boolean(),
      pickupAddress: z.string().trim().max(300).default(""),
      deliveryEnabled: z.boolean(),
      deliveryPrice: money,
      freeDeliveryFrom: money.nullable().default(null),
      minOrder: money,
      orderThanks: z.string().trim().max(500).default(""),
    })
    .refine((v) => v.pickupEnabled || v.deliveryEnabled, { message: "Kamida bitta usul (olib ketish yoki yetkazish) yoqilgan bo'lsin" }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const row = {
      accept_orders: input.acceptOrders,
      pickup_enabled: input.pickupEnabled,
      pickup_address: input.pickupAddress,
      delivery_enabled: input.deliveryEnabled,
      delivery_price: input.deliveryPrice,
      free_delivery_from: input.freeDeliveryFrom,
      min_order: input.minOrder,
      order_thanks: input.orderThanks,
    };
    const { data: existing } = await ctx.supabase.from("shop_settings").select("workspace_id").eq("workspace_id", ctx.workspaceId).maybeSingle();
    const { error } = existing
      ? await ctx.supabase.from("shop_settings").update(row).eq("workspace_id", ctx.workspaceId)
      : await ctx.supabase.from("shop_settings").insert({ ...row, workspace_id: ctx.workspaceId });
    if (error) throw new ActionError("internal", "Sozlamalar saqlanmadi");
    return { ok: true };
  },
});
