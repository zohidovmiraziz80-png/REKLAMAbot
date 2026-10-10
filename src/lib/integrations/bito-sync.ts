import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUzPhone } from "@/lib/phone";
import { DELIVERY_LABELS, formatMoney } from "@/lib/shop/format";
import {
  BitoError,
  createCustomer,
  createSaleOrder,
  detectImageHost,
  findCustomerByPhone,
  priceMap,
  productPages,
  type BitoCreds,
  type BitoProduct,
} from "./bito";
import { loadIntegration, type BitoSettings } from "./store";

/**
 * Bito ↔ TezDo'kon sinxronlash.
 * 1) Mahsulotlar: Bito → TezDo'kon (nomi, narxi tanlangan narx turidan, qoldiq tanlangan ombordan, kategoriya, rasm).
 * 2) Buyurtmalar: TezDo'kon → Bito (mijoz telefon bo'yicha topiladi yoki yaratiladi, keyin sotuv buyurtmasi).
 */

export type SyncResult = { total: number; active: number; withoutPrice: number; ms: number };

const LOCK_MINUTES = 15;

function stockOf(p: BitoProduct, s: BitoSettings): number {
  if (s.warehouseId && p._warehouses?.[s.warehouseId]) {
    const w = p._warehouses[s.warehouseId];
    return Math.max(0, Math.floor((w.amount ?? 0) - (w.booked ?? 0)));
  }
  const org = p.organizations?.find((o) => o.organization_id === s.organizationId) ?? p.organizations?.[0];
  return Math.max(0, Math.floor((org?.amount ?? 0) - (org?.booked ?? 0)));
}

/** Mahsulotlarni Bito'dan olib keladi. Bir vaqtda faqat bitta sinxronlash ishlaydi. */
export async function syncBitoProducts(db: SupabaseClient, workspaceId: string): Promise<SyncResult> {
  const integ = await loadIntegration(db, workspaceId, "bito");
  if (!integ) throw new BitoError(0, "Bito ulanmagan");
  const s = integ.settings;
  if (!s.organizationId || !s.priceId) throw new BitoError(0, "Avval filial va narx turini tanlang");

  // Qulf: boshqa sinxronlash ketayotgan bo'lsa chiqamiz
  const stale = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  const startedAt = new Date().toISOString();
  const { data: locked } = await db
    .from("integrations")
    .update({ sync_started_at: startedAt })
    .eq("workspace_id", workspaceId)
    .eq("provider", "bito")
    .or(`sync_started_at.is.null,sync_started_at.lt.${stale}`)
    .select("workspace_id")
    .maybeSingle();
  if (!locked) throw new BitoError(0, "Sinxronlash allaqachon ketmoqda. Bir necha daqiqadan keyin qayta urinib ko'ring.");

  const t0 = Date.now();
  const creds: BitoCreds = { apiKey: integ.creds.apiKey ?? "" };
  try {
    const collect = async () => {
      const all: BitoProduct[] = [];
      for await (const page of productPages(creds, s.organizationId)) all.push(...page);
      return all;
    };
    const [prices, products] = await Promise.all([priceMap(creds, s.priceId, s.organizationId), collect()]);

    // Rasm manzilini bir marta aniqlaymiz
    let imageHost = s.imageHost;
    if (imageHost === null) {
      const sample = products.find((p) => p.images?.[0] || p.image);
      imageHost = await detectImageHost(sample?.images?.[0] ?? sample?.image);
      if (imageHost !== null) {
        await db
          .from("integrations")
          .update({ settings: { ...s, imageHost } })
          .eq("workspace_id", workspaceId)
          .eq("provider", "bito");
      }
    }

    let active = 0;
    let withoutPrice = 0;
    const withImage: Record<string, unknown>[] = [];
    const noImage: Record<string, unknown>[] = [];
    for (const p of products) {
      if (!p._id || !p.name || p.is_archived) continue;
      const price = Math.round(prices.get(p._id) ?? 0);
      const stock = stockOf(p, s);
      if (price <= 0) withoutPrice++;
      const isActive = price > 0 && (!s.onlyInStock || stock > 0);
      if (isActive) active++;
      const rawImg = p.images?.[0] ?? p.image ?? "";
      const image = rawImg && imageHost !== null ? (/^https:\/\//.test(rawImg) ? rawImg : `${imageHost}${rawImg.startsWith("/") ? "" : "/"}${rawImg}`) : "";
      const row: Record<string, unknown> = {
        workspace_id: workspaceId,
        external_source: "bito",
        external_id: p._id,
        name: p.name.trim().slice(0, 120) || "Mahsulot",
        sku: (p.sku ?? "").slice(0, 64) || null,
        category: (p.category?.name ?? "").trim().slice(0, 60),
        price,
        stock,
        is_active: isActive,
        synced_at: startedAt,
      };
      if (image && /^https:\/\/[^\s"'<>()]+$/.test(image)) {
        row.image_url = image.slice(0, 500);
        withImage.push(row);
      } else {
        noImage.push(row);
      }
    }

    for (const rows of [withImage, noImage]) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db
          .from("products")
          .upsert(rows.slice(i, i + 500), { onConflict: "workspace_id,external_source,external_id", defaultToNull: false });
        if (error) throw new BitoError(0, `Mahsulotlar saqlanmadi: ${error.message}`);
      }
    }

    // Bito'da o'chirilgan mahsulotlarni yashiramiz
    await db
      .from("products")
      .update({ is_active: false })
      .eq("workspace_id", workspaceId)
      .eq("external_source", "bito")
      .lt("synced_at", startedAt);

    const result: SyncResult = { total: withImage.length + noImage.length, active, withoutPrice, ms: Date.now() - t0 };
    await db
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString(), last_sync_result: result, last_error: null, status: "active", sync_started_at: null })
      .eq("workspace_id", workspaceId)
      .eq("provider", "bito");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Noma'lum xato";
    await db
      .from("integrations")
      .update({ last_error: message.slice(0, 500), sync_started_at: null, ...(err instanceof BitoError && err.status === 401 ? { status: "error" } : {}) })
      .eq("workspace_id", workspaceId)
      .eq("provider", "bito");
    throw err;
  }
}

/** Sayt ochilganda: oxirgi sinxronlashdan 3 soat o'tgan bo'lsa, fonda yangilaymiz */
export async function maybeAutoSyncBito(db: SupabaseClient, workspaceId: string) {
  const { data } = await db
    .from("integrations")
    .select("status, settings, last_sync_at, sync_started_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", "bito")
    .maybeSingle();
  if (!data || data.status !== "active") return;
  const settings = data.settings as Partial<BitoSettings> | null;
  if (settings?.syncProducts === false || !settings?.organizationId || !settings?.priceId) return;
  const last = data.last_sync_at ? new Date(data.last_sync_at as string).getTime() : 0;
  if (Date.now() - last < 3 * 3600_000) return;
  try {
    await syncBitoProducts(db, workspaceId);
  } catch {
    // xato integratsiya sahifasida ko'rinadi
  }
}

/** Buyurtmani Bito'ga sotuv buyurtmasi sifatida yuboradi */
export async function pushOrderToBito(db: SupabaseClient, orderId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: order } = await db
    .from("orders")
    .select("id, workspace_id, number, customer_id, customer_name, phone, address, comment, delivery_method, delivery_price, items, total, external_ids")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Buyurtma topilmadi" };
  if ((order.external_ids as Record<string, string> | null)?.bito) return { ok: true };

  const integ = await loadIntegration(db, order.workspace_id as string, "bito");
  if (!integ || integ.status === "disabled" || !integ.settings.sendOrders) return { ok: true };
  const s = integ.settings;
  const fail = async (error: string) => {
    await db.from("orders").update({ sync_error: error.slice(0, 500) }).eq("id", orderId);
    return { ok: false, error };
  };
  if (!s.organizationId || !s.priceId || !s.warehouseId || !s.responsibleId) {
    return fail("Bito sozlamalari to'liq emas (filial, narx turi, ombor, mas'ul xodim)");
  }
  const creds: BitoCreds = { apiKey: integ.creds.apiKey ?? "" };

  try {
    const items = (order.items as { product_id: string; name: string; price: number; qty: number }[]) ?? [];
    const { data: mapped } = await db
      .from("products")
      .select("id, external_id")
      .eq("workspace_id", order.workspace_id)
      .eq("external_source", "bito")
      .in(
        "id",
        items.map((i) => i.product_id),
      );
    const ext = new Map((mapped ?? []).map((m) => [m.id as string, m.external_id as string]));
    const lines = items
      .filter((i) => ext.has(i.product_id))
      .map((i) => ({ product_id: ext.get(i.product_id)!, amount: i.qty, price: i.price, price_id: s.priceId, warehouse_id: s.warehouseId }));
    const missing = items.filter((i) => !ext.has(i.product_id));
    if (!lines.length) return fail("Buyurtmadagi mahsulotlar Bito'dan olinmagan — Bito'ga yuborilmadi");

    // Mijoz
    let customerId: string | null = null;
    if (order.customer_id) {
      const { data: c } = await db.from("customers").select("external_ids").eq("id", order.customer_id).maybeSingle();
      customerId = (c?.external_ids as Record<string, string> | null)?.bito ?? null;
    }
    if (!customerId) {
      const found = await findCustomerByPhone(creds, order.phone as string);
      const customer =
        found ??
        (await createCustomer(creds, {
          name: (order.customer_name as string | null) || formatUzPhone(order.phone as string),
          phone_number: order.phone as string,
          organization_ids: [s.organizationId],
          address: (order.address as string | null) ?? undefined,
        }));
      customerId = customer._id;
      if (order.customer_id) {
        const { data: c } = await db.from("customers").select("external_ids").eq("id", order.customer_id).maybeSingle();
        await db
          .from("customers")
          .update({ external_ids: { ...((c?.external_ids as Record<string, string> | null) ?? {}), bito: customerId } })
          .eq("id", order.customer_id);
      }
    }

    const note = [
      `TezDo'kon buyurtma №${order.number}`,
      `Tel: ${formatUzPhone(order.phone as string)}`,
      `${DELIVERY_LABELS[order.delivery_method as keyof typeof DELIVERY_LABELS] ?? order.delivery_method}${order.address ? `: ${order.address}` : ""}`,
      Number(order.delivery_price) > 0 ? `Yetkazish: ${formatMoney(Number(order.delivery_price))}` : "",
      `Jami: ${formatMoney(Number(order.total))}`,
      missing.length ? `Bito'da yo'q mahsulotlar: ${missing.map((m) => `${m.name} × ${m.qty}`).join(", ")}` : "",
      order.comment ? `Izoh: ${order.comment}` : "",
    ]
      .filter(Boolean)
      .join(". ");

    const created = await createSaleOrder(creds, {
      uuid: `TZ-${String(order.id).slice(0, 8)}-${order.number}`,
      organization_id: s.organizationId,
      customer_id: customerId,
      responsible_id: s.responsibleId,
      state: s.orderState,
      date: new Date().toISOString(),
      note: note.slice(0, 2000),
      price_id: s.priceId,
      products: lines,
    });

    await db
      .from("orders")
      .update({
        external_ids: { ...((order.external_ids as Record<string, string> | null) ?? {}), bito: created._id, bito_number: created.number ?? "" },
        sync_error: null,
      })
      .eq("id", orderId);
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? `Bito: ${err.message}` : "Bito'ga yuborilmadi");
  }
}
