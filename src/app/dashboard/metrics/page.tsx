import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { getMetrics } from "@/actions/metrics";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, SOURCE_LABELS, formatMoney } from "@/lib/shop/format";

export const metadata: Metadata = { title: "Metrikalar" };
export const dynamic = "force-dynamic";

const PAY_LABELS: Record<string, string> = { cash: "Naqd", card: "Kartaga o'tkazma", payme: "Payme", click: "Click", multicard: "Multicard" };

function delta(cur: number, prev: number) {
  if (!prev) return cur ? { text: "yangi", up: true } : null;
  const p = Math.round(((cur - prev) / prev) * 100);
  return { text: `${p > 0 ? "+" : ""}${p}%`, up: p >= 0 };
}

function short(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} mln`;
  if (n >= 1000) return `${Math.round(n / 1000)} ming`;
  return String(n);
}

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const days = d === "7" ? 7 : d === "90" ? 90 : 30;
  const r = await runAction(getMetrics, { days });
  if (!r.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{r.error}</p>;
  const m = r.data;
  const maxDay = Math.max(1, ...m.daily.map((x) => x.revenue));
  const revDelta = delta(m.revenue, m.prevRevenue);
  const ordDelta = delta(m.orders, m.prevOrders);
  const totalSrc = m.sources.reduce((s, x) => s + x.revenue, 0) || 1;
  const totalPay = m.payments.reduce((s, x) => s + x.revenue, 0) || 1;
  const allStatus = Object.values(m.statuses).reduce((s, x) => s + x, 0);

  const kpis = [
    { label: "Tushum", value: formatMoney(m.revenue), d: revDelta },
    { label: "Buyurtmalar", value: String(m.orders), d: ordDelta },
    { label: "O'rtacha chek", value: formatMoney(m.avgCheck), d: null },
    { label: "To'langan", value: `${m.paidShare}%`, d: null },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Metrikalar</h1>
          <p className="mt-1 text-muted">Bekor qilingan buyurtmalar tushumga kirmaydi. O&apos;zgarish oldingi shuncha kunga nisbatan.</p>
        </div>
        <nav className="flex gap-1 rounded-full bg-white p-1">
          {[7, 30, 90].map((n) => (
            <Link
              key={n}
              href={`/dashboard/metrics?d=${n}`}
              className={`rounded-full px-3.5 py-1.5 text-sm ${n === days ? "bg-brand-700 font-semibold text-white" : "text-ink hover:bg-surface"}`}
            >
              {n} kun
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-sm text-muted">{k.label}</p>
            <p className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{k.value}</p>
            {k.d && <p className={`mt-1 text-xs font-semibold ${k.d.up ? "text-emerald-600" : "text-red-600"}`}>{k.d.text}</p>}
          </div>
        ))}
      </div>

      <section className="mt-5 rounded-2xl border border-line bg-white p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Kunlik tushum</h2>
          <span className="text-xs text-muted">eng ko&apos;p: {formatMoney(maxDay === 1 ? 0 : maxDay)}</span>
        </div>
        <div className="mt-4 flex h-44 items-end gap-[2px]">
          {m.daily.map((x) => (
            <div key={x.date} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-brand-600/80 transition group-hover:bg-accent-500"
                style={{ height: `${x.revenue ? Math.max(3, (x.revenue / maxDay) * 100) : 0}%` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
                {x.date.slice(8, 10)}.{x.date.slice(5, 7)} · {formatMoney(x.revenue)} · {x.orders} ta
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>
            {m.daily[0]?.date.slice(8, 10)}.{m.daily[0]?.date.slice(5, 7)}
          </span>
          <span>bugun</span>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Eng ko&apos;p sotilgan mahsulotlar</h2>
          {m.topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Bu davrda sotuv yo&apos;q.</p>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {m.topProducts.map((p, i) => (
                <li key={p.name} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 text-muted">{i + 1}.</span>
                      {p.name}
                    </span>
                    <span className="shrink-0 font-medium">{formatMoney(p.revenue)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-accent-500" style={{ width: `${(p.revenue / (m.topProducts[0]?.revenue || 1)) * 100}%` }} />
                    </div>
                    <span className="w-14 text-right text-xs text-muted">{p.qty} dona</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">Mijozlar</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface p-3">
                <p className="text-lg font-bold">{m.customers.total}</p>
                <p className="text-xs text-muted">jami</p>
              </div>
              <div className="rounded-xl bg-surface p-3">
                <p className="text-lg font-bold">{m.customers.newOnes}</p>
                <p className="text-xs text-muted">yangi</p>
              </div>
              <div className="rounded-xl bg-surface p-3">
                <p className="text-lg font-bold">{m.customers.returning}</p>
                <p className="text-xs text-muted">qaytgan</p>
              </div>
            </div>
          </section>

          {[
            { title: "Qayerdan", list: m.sources, total: totalSrc, label: (k: string) => SOURCE_LABELS[k as keyof typeof SOURCE_LABELS] ?? k },
            { title: "To'lov usuli", list: m.payments, total: totalPay, label: (k: string) => PAY_LABELS[k] ?? k },
          ].map((b) => (
            <section key={b.title} className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-semibold">{b.title}</h2>
              {b.list.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Ma&apos;lumot yo&apos;q.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {b.list.map((x) => (
                    <li key={x.key}>
                      <div className="flex justify-between gap-2">
                        <span>{b.label(x.key)}</span>
                        <span className="text-muted">
                          {x.orders} ta · {short(x.revenue)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${(x.revenue / b.total) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Buyurtma holatlari</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {ORDER_STATUSES.map((s) => (
            <Link key={s} href={`/dashboard/orders?status=${s}`} className="rounded-xl bg-surface px-3 py-2 text-sm hover:bg-brand-50">
              {ORDER_STATUS_LABELS[s]}: <b>{m.statuses[s] ?? 0}</b>
              {allStatus > 0 && <span className="ml-1 text-xs text-muted">({Math.round(((m.statuses[s] ?? 0) / allStatus) * 100)}%)</span>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
