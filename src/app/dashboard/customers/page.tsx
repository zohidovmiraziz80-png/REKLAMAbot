import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { listCustomers, listOrders } from "@/actions/shop";
import { formatUzPhone } from "@/lib/phone";
import { ORDER_STATUS_EMOJI, ORDER_STATUS_LABELS, formatDateTime, formatMoney } from "@/lib/shop/format";
import { CustomerNote } from "./customer-note";

export const metadata: Metadata = { title: "Mijozlar" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const { q = "", id } = await searchParams;
  const result = await runAction(listCustomers, { query: q.slice(0, 60) });
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  const customers = result.data;

  const selected = id && /^[0-9a-f-]{36}$/i.test(id) ? customers.find((c) => c.id === id) : undefined;
  const history = selected ? await runAction(listOrders, { customerId: selected.id, limit: 50 }) : null;

  const totalSpent = customers.reduce((s, c) => s + Number(c.total_spent), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mijozlar</h1>
      <p className="mt-1 text-muted">
        {customers.length} ta mijoz{!q && customers.length > 0 && <> · jami xarid {formatMoney(totalSpent)}</>}. Buyurtma berganlar avtomatik qo&apos;shiladi.
      </p>

      <form className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Ism yoki telefon…"
          className="block w-full max-w-xs rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button type="submit" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-surface">
          Qidirish
        </button>
      </form>

      {selected && (
        <section className="mt-4 rounded-2xl border border-brand-100 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{selected.name ?? "Ismsiz"}</p>
              <p className="text-sm text-muted">
                <a href={`tel:${selected.phone}`} className="text-brand-600 hover:underline">
                  {formatUzPhone(selected.phone)}
                </a>
                {selected.telegram_username && <> · @{selected.telegram_username}</>}
                {selected.address && <> · {selected.address}</>}
              </p>
            </div>
            <Link href={`/dashboard/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="text-sm text-muted hover:text-ink">
              Yopish ×
            </Link>
          </div>
          <div className="mt-3 flex gap-4 text-sm">
            <span>
              Buyurtmalar: <b>{selected.orders_count}</b>
            </span>
            <span>
              Jami: <b>{formatMoney(selected.total_spent)}</b>
            </span>
          </div>
          <CustomerNote id={selected.id} initial={selected.note} />
          {history?.ok && history.data.orders.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {history.data.orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                  <span className="font-semibold">№{o.number}</span>
                  <span>
                    {ORDER_STATUS_EMOJI[o.status]} {ORDER_STATUS_LABELS[o.status]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted">{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</span>
                  <span className="font-medium">{formatMoney(o.total)}</span>
                  <span className="text-xs text-muted">{formatDateTime(o.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
        {customers.length === 0 ? (
          <p className="px-4 py-12 text-center text-muted">{q ? "Hech kim topilmadi" : "Hali mijoz yo'q. Birinchi buyurtmadan keyin shu yerda paydo bo'ladi."}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Mijoz</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Telefon</th>
                <th className="px-4 py-2 text-right font-medium">Buyurtma</th>
                <th className="px-4 py-2 text-right font-medium">Jami</th>
                <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Oxirgi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((c) => (
                <tr key={c.id} className={c.id === selected?.id ? "bg-brand-50" : "hover:bg-surface/60"}>
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/customers?${new URLSearchParams({ ...(q ? { q } : {}), id: c.id }).toString()}`} className="font-medium hover:underline">
                      {c.name ?? "Ismsiz"}
                    </Link>
                    {c.telegram_chat_id && <span className="ml-1.5 text-xs text-sky-600">Telegram</span>}
                    <span className="block text-xs text-muted sm:hidden">{formatUzPhone(c.phone)}</span>
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">{formatUzPhone(c.phone)}</td>
                  <td className="px-4 py-2.5 text-right">{c.orders_count}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatMoney(c.total_spent)}</td>
                  <td className="hidden px-4 py-2.5 text-right text-xs text-muted md:table-cell">{formatDateTime(c.last_order_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
