import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { listOrders } from "@/actions/shop";
import { getYandexSetup } from "@/actions/delivery";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/shop/format";
import { OrdersList } from "./orders-list";

export const metadata: Metadata = { title: "Buyurtmalar" };
// Yandex kuryer chaqirish 20 soniyagacha davom etishi mumkin
export const maxDuration = 60;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: raw } = await searchParams;
  const status = ORDER_STATUSES.includes(raw as OrderStatus) ? (raw as OrderStatus) : undefined;
  const [result, yandexSetup] = await Promise.all([runAction(listOrders, { status }), runAction(getYandexSetup, {})]);
  const yandex = yandexSetup.ok && yandexSetup.data.connected && yandexSetup.data.status === "active";
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  const { orders, counts } = result.data;

  const tabs: { key?: OrderStatus; label: string; n: number }[] = [
    { label: "Hammasi", n: counts.all },
    ...ORDER_STATUSES.map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s], n: counts[s] })),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Buyurtmalar</h1>
          <p className="mt-1 text-muted">Sayt va Telegram Mini App&apos;dan kelgan buyurtmalar.</p>
        </div>
        <Link href="/dashboard/orders/settings" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-surface">
          ⚙️ Do&apos;kon sozlamalari
        </Link>
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const active = t.key === status;
          return (
            <Link
              key={t.key ?? "all"}
              href={t.key ? `/dashboard/orders?status=${t.key}` : "/dashboard/orders"}
              className={`rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap ${active ? "bg-brand-700 font-semibold text-white" : "bg-white text-ink hover:bg-surface"}`}
            >
              {t.label}
              <span className={`ml-1.5 ${active ? "text-white/70" : "text-muted"}`}>{t.n}</span>
            </Link>
          );
        })}
      </nav>

      <OrdersList key={status ?? "all"} initial={orders} emptyAll={counts.all === 0} yandex={yandex} />
    </div>
  );
}
