"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Order } from "@/actions/shop";
import { formatUzPhone } from "@/lib/phone";
import {
  DELIVERY_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_EMOJI,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  SOURCE_LABELS,
  formatDateTime,
  formatMoney,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/shop/format";
import { updateOrderAction } from "./actions";

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: "bg-accent-50 text-accent-600",
  confirmed: "bg-brand-50 text-brand-700",
  delivering: "bg-sky-50 text-sky-700",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

const select = "rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500";

export function OrdersList({ initial, emptyAll }: { initial: Order[]; emptyAll: boolean }) {
  const [orders, setOrders] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(initial[0]?.status === "new" ? initial[0].id : null);

  if (!orders.length) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
        <p className="text-4xl">📦</p>
        {emptyAll ? (
          <>
            <p className="mt-3 font-semibold">Hali buyurtma yo&apos;q</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              <Link href="/dashboard/products" className="font-medium text-brand-600 hover:underline">
                Mahsulot qo&apos;shing
              </Link>{" "}
              va saytni nashr qiling — mijozlar saytda yoki Telegram bot ichida savatga qo&apos;shib buyurtma beradi. Yangi buyurtma
              Telegram&apos;ga ham keladi.
            </p>
          </>
        ) : (
          <p className="mt-3 text-muted">Bu holatda buyurtma yo&apos;q</p>
        )}
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {orders.map((o) => (
        <OrderCard
          key={o.id}
          order={o}
          open={openId === o.id}
          onToggle={() => setOpenId(openId === o.id ? null : o.id)}
          onChange={(patch) => setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, ...patch } : x)))}
        />
      ))}
    </ul>
  );
}

function OrderCard({ order: o, open, onToggle, onChange }: { order: Order; open: boolean; onToggle: () => void; onChange: (p: Partial<Order>) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(o.admin_note);
  const count = o.items.reduce((s, i) => s + i.qty, 0);

  function patch(input: { status?: OrderStatus; paymentStatus?: PaymentStatus; adminNote?: string }, local: Partial<Order>) {
    start(async () => {
      setError(null);
      const r = await updateOrderAction({ id: o.id, ...input });
      if (r.ok) onChange(local);
      else setError(r.error);
    });
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-white">
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface/60">
        <span className="font-semibold">№{o.number}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status]}`}>
          {ORDER_STATUS_EMOJI[o.status]} {ORDER_STATUS_LABELS[o.status]}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {o.customer_name ?? "—"} · <span className="text-muted">{formatUzPhone(o.phone)}</span>
        </span>
        <span className="text-sm text-muted">{count} ta</span>
        <span className="font-semibold">{formatMoney(o.total)}</span>
        <span className="w-full text-xs text-muted sm:w-auto">{formatDateTime(o.created_at)}</span>
      </button>

      {open && (
        <div className="grid gap-5 border-t border-line px-4 py-4 md:grid-cols-[1fr_280px]">
          <div>
            <ul className="divide-y divide-line">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex items-center gap-3 py-2">
                  {i.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image_url} alt="" className="size-10 rounded-lg object-cover" />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-lg bg-surface text-xl">{i.emoji || "📦"}</div>
                  )}
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  <span className="text-sm text-muted">
                    {i.qty} × {formatMoney(i.price)}
                  </span>
                  <span className="w-28 text-right font-medium">{formatMoney(i.qty * i.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 space-y-1 border-t border-line pt-2 text-sm">
              {o.delivery_price > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Yetkazish</span>
                  <span>{formatMoney(o.delivery_price)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <span>Jami</span>
                <span>{formatMoney(o.total)}</span>
              </div>
            </div>

            <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Mijoz</dt>
                <dd>
                  {o.customer_name ?? "—"}
                  {o.customer_id && (
                    <Link href={`/dashboard/customers?id=${o.customer_id}`} className="ml-2 text-xs text-brand-600 hover:underline">
                      profil →
                    </Link>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Telefon</dt>
                <dd>
                  <a href={`tel:${o.phone}`} className="text-brand-600 hover:underline">
                    {formatUzPhone(o.phone)}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Qabul qilish</dt>
                <dd>
                  {DELIVERY_LABELS[o.delivery_method]}
                  {o.address && <>: {o.address}</>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Manba</dt>
                <dd>
                  {SOURCE_LABELS[o.source]}
                  {o.chat_id ? " · Telegram orqali xabar oladi" : ""}
                </dd>
              </div>
              {o.comment && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">Mijoz izohi</dt>
                  <dd className="whitespace-pre-line">{o.comment}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Holat</span>
              <select
                value={o.status}
                disabled={pending || o.status === "cancelled"}
                onChange={(e) => {
                  const s = e.target.value as OrderStatus;
                  if (s === "cancelled" && !window.confirm("Buyurtma bekor qilinsinmi? Qoldiq qaytariladi.")) return;
                  patch({ status: s }, { status: s });
                }}
                className={`${select} w-full`}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_EMOJI[s]} {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">To&apos;lov</span>
              <select
                value={o.payment_status}
                disabled={pending}
                onChange={(e) => {
                  const s = e.target.value as PaymentStatus;
                  patch({ paymentStatus: s }, { payment_status: s });
                }}
                className={`${select} w-full`}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Ichki izoh (mijoz ko&apos;rmaydi)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className={`${select} w-full`} />
            </label>
            {note !== o.admin_note && (
              <button
                type="button"
                disabled={pending}
                onClick={() => patch({ adminNote: note }, { admin_note: note })}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Izohni saqlash
              </button>
            )}
            {o.chat_id && o.status !== "cancelled" && <p className="text-xs text-muted">Holat o&apos;zgarsa, mijozga Telegram&apos;da xabar boradi.</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </li>
  );
}
