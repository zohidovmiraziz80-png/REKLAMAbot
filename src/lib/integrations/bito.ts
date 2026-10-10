/**
 * Bito ERP integratsiya API klienti.
 * Hujjat: https://docs.bito.uz/guide/api.html
 * Kalit: "api-key: <username>:<secret>" (Bito → Integratsiya bo'limidan nusxalanadi). Faqat serverda.
 */

const BASE = "https://api.bito.uz/integration-api/integration/api/v2";

export class BitoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type BitoCreds = { apiKey: string };

type Envelope<T> = { code?: number; message?: string; status_code?: number; data?: T };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function bito<T>(creds: BitoCreds, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers: { "api-key": creds.apiKey, "content-type": "application/json", "accept-language": "uz" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      if (attempt < 2) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw new BitoError(0, "Bito serveriga ulanib bo'lmadi");
    }
    if (res.status === 429 && attempt < 2) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    const json = (await res.json().catch(() => ({}))) as Envelope<T>;
    if (json.code !== 0) {
      const status = json.status_code ?? res.status;
      const msg =
        status === 401
          ? "API kalit noto'g'ri yoki muddati tugagan"
          : status === 403
            ? "API kalitga bu amal uchun ruxsat berilmagan"
            : json.message || `Bito xatosi (${status})`;
      throw new BitoError(status, msg);
    }
    return json.data as T;
  }
  throw new BitoError(0, "Bito javob bermadi");
}

// ===== Turlar (faqat kerakli maydonlar) =====

export type BitoOrganization = { _id: string; name: string; currency_id?: string; is_default?: boolean };
export type BitoPrice = { _id: string; name: string; type: string; status: string; is_main?: boolean; currency_id?: string };
export type BitoWarehouse = { _id: string; name: string; organization_id?: string; is_main?: boolean; status?: string };
export type BitoEmployee = { _id: string; full_name?: string; phone_number?: string };
export type BitoProduct = {
  _id: string;
  name: string;
  sku?: string;
  barcode?: string;
  image?: string;
  images?: string[];
  category?: { _id: string; name: string } | null;
  organizations?: { organization_id: string; amount?: number; booked?: number; is_available_for_sale?: boolean }[];
  _warehouses?: Record<string, { amount?: number; booked?: number }>;
  is_product?: boolean;
  is_archived?: boolean;
};
export type BitoPriceItem = { amount: number; product?: { _id: string } | null; product_id?: string };
export type BitoCustomer = { _id: string; name: string; phone_number?: string };

type Paging<T> = { total: number; data: T[] };

// ===== Ma'lumotnomalar =====

export const getMe = (c: BitoCreds) => bito<{ id?: string; user_name?: string; status?: string }>(c, "GET", "/profile/getMe");
export const getOrganizations = (c: BitoCreds) => bito<BitoOrganization[]>(c, "GET", "/organization/get-all");
export const getPrices = (c: BitoCreds) => bito<BitoPrice[]>(c, "GET", "/price/get-all?status=active&type=sale");
export const getWarehouses = (c: BitoCreds) => bito<BitoWarehouse[]>(c, "POST", "/warehouse/get-all", {});
export async function getEmployees(c: BitoCreds): Promise<BitoEmployee[]> {
  const r = await bito<Paging<BitoEmployee>>(c, "POST", "/employee/get-paging", { page: 1, limit: 200 });
  return r.data ?? [];
}

// ===== Mahsulotlar va narxlar =====

export async function* productPages(c: BitoCreds, organizationId: string) {
  const limit = 200;
  for (let page = 1; page <= 200; page++) {
    const r = await bito<Paging<BitoProduct>>(c, "POST", "/product/get-paging", {
      page,
      limit,
      organization_id: organizationId || undefined,
      is_archived: false,
      is_product: true,
    });
    yield r.data ?? [];
    if (!r.data?.length || page * limit >= r.total) break;
  }
}

export async function priceMap(c: BitoCreds, priceId: string, organizationId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const limit = 200;
  for (let page = 1; page <= 200; page++) {
    const r = await bito<Paging<BitoPriceItem>>(c, "POST", "/price/items/get-paging", {
      page,
      limit,
      price_id: priceId,
      organization_id: organizationId || undefined,
    });
    for (const it of r.data ?? []) {
      const pid = it.product?._id ?? it.product_id;
      if (pid && typeof it.amount === "number") map.set(pid, it.amount);
    }
    if (!r.data?.length || page * limit >= r.total) break;
  }
  return map;
}

/** Mahsulot rasmi Bito'da "/uploads/..." ko'rinishida — to'liq manzilni topamiz */
const IMAGE_HOSTS = ["https://api.bito.uz", "https://app.bito.uz", "https://bito.uz", "https://cdn.bito.uz"];
export async function detectImageHost(samplePath: string | undefined): Promise<string | null> {
  if (!samplePath) return null;
  if (/^https:\/\//.test(samplePath)) return "";
  for (const host of IMAGE_HOSTS) {
    try {
      const res = await fetch(`${host}${samplePath}`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(6000) });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.startsWith("image/")) return host;
    } catch {
      // keyingisini sinaymiz
    }
  }
  return null;
}

// ===== Mijoz va buyurtma =====

export async function findCustomerByPhone(c: BitoCreds, phone: string): Promise<BitoCustomer | null> {
  for (const p of [phone, phone.replace(/^\+/, "")]) {
    try {
      const r = await bito<BitoCustomer | null>(c, "GET", `/customer/get-by-phone-number?phone_number=${encodeURIComponent(p)}`);
      if (r && r._id) return r;
    } catch (err) {
      if (err instanceof BitoError && (err.status === 400 || err.status === 404)) continue;
      throw err;
    }
  }
  return null;
}

export const createCustomer = (c: BitoCreds, body: { name: string; phone_number: string; organization_ids: string[]; address?: string; telegram_link?: string }) =>
  bito<BitoCustomer>(c, "POST", "/customer/create", { type: "natural", state: "new", ...body });

export type BitoOrderLine = { product_id: string; amount: number; price: number; price_id: string; warehouse_id: string };

export const createSaleOrder = (
  c: BitoCreds,
  body: {
    uuid: string;
    organization_id: string;
    customer_id: string;
    responsible_id: string;
    state: string;
    date: string;
    note: string;
    price_id: string;
    products: BitoOrderLine[];
  },
) => bito<{ _id: string; number?: string }>(c, "POST", "/sale-order/create", { discounts: [], ...body });
