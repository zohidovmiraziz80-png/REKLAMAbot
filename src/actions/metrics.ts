import { z } from "zod";
import { defineAction } from "./define";

/** Savdo statistikasi (buyurtmalar jadvalidan hisoblanadi, UTC+5 kunlar bo'yicha) */

export type Metrics = {
  days: number;
  revenue: number;
  prevRevenue: number;
  orders: number;
  prevOrders: number;
  avgCheck: number;
  paidShare: number;
  cancelled: number;
  customers: { total: number; returning: number; newOnes: number };
  daily: { date: string; revenue: number; orders: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  sources: { key: string; orders: number; revenue: number }[];
  payments: { key: string; orders: number; revenue: number }[];
  statuses: Record<string, number>;
};

type Row = {
  created_at: string;
  status: string;
  payment_status: string;
  payment_method: string;
  source: string;
  total: number;
  phone: string;
  items: { name: string; qty: number; price: number }[] | null;
};

const TZ = 5 * 3600 * 1000;
const dayKey = (iso: string) => new Date(new Date(iso).getTime() + TZ).toISOString().slice(0, 10);

export const getMetrics = defineAction({
  name: "getMetrics",
  description: "Tanlangan davr (7, 30 yoki 90 kun) bo'yicha savdo statistikasi: tushum, buyurtmalar, o'rtacha chek, kunlik grafik, top mahsulotlar.",
  input: z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }),
  handler: async (ctx, input): Promise<Metrics> => {
    const now = Date.now();
    // Bugungi kun ham kiradi: davr boshi = (days-1) kun oldingi kunning boshi (UTC+5)
    const todayStart = Math.floor((now + TZ) / 86_400_000) * 86_400_000 - TZ;
    const from = todayStart - (input.days - 1) * 86_400_000;
    const prevFrom = from - input.days * 86_400_000;

    const rows: Row[] = [];
    for (let off = 0; off < 20_000; off += 1000) {
      const { data } = await ctx.supabase
        .from("orders")
        .select("created_at, status, payment_status, payment_method, source, total, phone, items")
        .eq("workspace_id", ctx.workspaceId)
        .gte("created_at", new Date(prevFrom).toISOString())
        .order("created_at", { ascending: true })
        .range(off, off + 999);
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < 1000) break;
    }

    const cur = rows.filter((r) => new Date(r.created_at).getTime() >= from);
    const prev = rows.filter((r) => new Date(r.created_at).getTime() < from);
    const ok = (r: Row) => r.status !== "cancelled";
    const sum = (list: Row[]) => list.filter(ok).reduce((s, r) => s + Number(r.total), 0);

    const daily = new Map<string, { revenue: number; orders: number }>();
    for (let t = from; t <= todayStart; t += 86_400_000) daily.set(new Date(t + TZ).toISOString().slice(0, 10), { revenue: 0, orders: 0 });
    const products = new Map<string, { qty: number; revenue: number }>();
    const sources = new Map<string, { orders: number; revenue: number }>();
    const payments = new Map<string, { orders: number; revenue: number }>();
    const statuses: Record<string, number> = {};
    const phones = new Map<string, number>();

    for (const r of cur) {
      statuses[r.status] = (statuses[r.status] ?? 0) + 1;
      if (!ok(r)) continue;
      const d = daily.get(dayKey(r.created_at));
      if (d) {
        d.revenue += Number(r.total);
        d.orders += 1;
      }
      for (const i of r.items ?? []) {
        const p = products.get(i.name) ?? { qty: 0, revenue: 0 };
        p.qty += Number(i.qty);
        p.revenue += Number(i.qty) * Number(i.price);
        products.set(i.name, p);
      }
      for (const [map, key] of [
        [sources, r.source],
        [payments, r.payment_method],
      ] as const) {
        const v = map.get(key) ?? { orders: 0, revenue: 0 };
        v.orders += 1;
        v.revenue += Number(r.total);
        map.set(key, v);
      }
      phones.set(r.phone, (phones.get(r.phone) ?? 0) + 1);
    }

    // Qaytgan mijoz: davr ichida 2+ buyurtma yoki davrdan oldin ham buyurtma bergan
    const earlier = new Set(prev.filter(ok).map((r) => r.phone));
    let returning = 0;
    for (const [phone, n] of phones) if (n > 1 || earlier.has(phone)) returning++;

    const okCur = cur.filter(ok);
    const revenue = sum(cur);
    return {
      days: input.days,
      revenue,
      prevRevenue: sum(prev),
      orders: okCur.length,
      prevOrders: prev.filter(ok).length,
      avgCheck: okCur.length ? Math.round(revenue / okCur.length) : 0,
      paidShare: okCur.length ? Math.round((okCur.filter((r) => r.payment_status === "paid").length / okCur.length) * 100) : 0,
      cancelled: statuses.cancelled ?? 0,
      customers: { total: phones.size, returning, newOnes: phones.size - returning },
      daily: [...daily.entries()].map(([date, v]) => ({ date, ...v })),
      topProducts: [...products.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      sources: [...sources.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.revenue - a.revenue),
      payments: [...payments.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.revenue - a.revenue),
      statuses,
    };
  },
});
