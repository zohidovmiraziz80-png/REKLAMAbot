"use client";

import { useState, useTransition } from "react";
import { YANDEX_STATUS_UZ } from "@/lib/delivery/yandex-status";
import { formatMoney } from "@/lib/shop/format";
import { yandexCancelAction, yandexDispatchAction, yandexEstimateAction, yandexRefreshAction } from "./actions";

const FINAL = new Set(["delivered_finish", "returned_finish", "cancelled", "cancelled_with_payment", "cancelled_by_taxi", "cancelled_with_items_on_hands", "failed", "estimating_failed", "performer_not_found"]);

export function YandexPanel({ orderId, ext, onExt }: { orderId: string; ext: Record<string, string>; onExt: (patch: Record<string, string>) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ price: number; etaMinutes: number | null; distanceKm: number | null; approximate: boolean } | null>(null);
  const active = ext.yandex && ext.yandex_status && !FINAL.has(ext.yandex_status);
  const btn = "rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      await fn();
    });

  return (
    <div className="space-y-2 rounded-md border border-line bg-surface/50 p-2.5 text-xs">
      <p className="font-semibold">🚕 Yandex kuryer</p>
      {ext.yandex && (
        <div className="space-y-0.5">
          <p>
            Holat: <b>{YANDEX_STATUS_UZ[ext.yandex_status ?? ""] ?? ext.yandex_status}</b>
          </p>
          {ext.yandex_price && <p>Narx: {formatMoney(Number(ext.yandex_price))}</p>}
          {ext.yandex_courier && <p>Kuryer: {ext.yandex_courier}</p>}
        </div>
      )}
      {quote && !active && (
        <p className="rounded bg-white p-2">
          Taxminiy narx: <b>{formatMoney(quote.price)}</b>
          {quote.distanceKm ? ` · ${quote.distanceKm} km` : ""}
          {quote.etaMinutes ? ` · ~${quote.etaMinutes} daq` : ""}
          {quote.approximate && <span className="mt-1 block text-amber-700">⚠️ Manzil matndan topildi — kuryer chaqirishdan oldin manzil to&apos;g&apos;riligini mijoz bilan tekshiring.</span>}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {!active && !quote && (
          <button
            type="button"
            disabled={pending}
            className={`${btn} bg-white text-ink hover:bg-surface`}
            onClick={() =>
              run(async () => {
                const r = await yandexEstimateAction(orderId);
                if (r.ok) setQuote(r.data);
                else setError(r.error);
              })
            }
          >
            {pending ? "Hisoblanmoqda…" : "Narxni hisoblash"}
          </button>
        )}
        {!active && quote && (
          <button
            type="button"
            disabled={pending}
            className={`${btn} bg-amber-400 text-black hover:bg-amber-300`}
            onClick={() => {
              if (!window.confirm(`Yandex kuryer chaqirilsinmi? Taxminiy narx: ${formatMoney(quote.price)}`)) return;
              run(async () => {
                const r = await yandexDispatchAction(orderId);
                if (r.ok) {
                  onExt({ yandex: r.data.claimId, yandex_status: r.data.status, ...(r.data.price ? { yandex_price: String(r.data.price) } : {}) });
                  setQuote(null);
                } else setError(r.error);
              });
            }}
          >
            {pending ? "Chaqirilmoqda…" : "Kuryer chaqirish"}
          </button>
        )}
        {ext.yandex && (
          <button
            type="button"
            disabled={pending}
            className={`${btn} bg-white text-ink hover:bg-surface`}
            onClick={() =>
              run(async () => {
                const r = await yandexRefreshAction(orderId);
                if (r.ok) onExt({ yandex_status: r.data });
                else setError(r.error);
              })
            }
          >
            Yangilash
          </button>
        )}
        {active && (
          <button
            type="button"
            disabled={pending}
            className={`${btn} bg-white text-red-600 hover:bg-red-50`}
            onClick={() => {
              if (!window.confirm("Kuryer chaqiruvi bekor qilinsinmi? Kuryer do'konga yetib kelgan bo'lsa, to'lov olinishi mumkin.")) return;
              run(async () => {
                const r = await yandexCancelAction(orderId);
                if (r.ok) {
                  onExt({ yandex_status: "cancelled" });
                  setError(r.data.message);
                } else setError(r.error);
              });
            }}
          >
            Bekor qilish
          </button>
        )}
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
