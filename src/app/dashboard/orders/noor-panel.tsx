"use client";

import { useState, useTransition } from "react";
import { NOOR_CANCELLABLE, NOOR_STAGE_UZ } from "@/lib/delivery/noor-status";
import { formatMoney } from "@/lib/shop/format";
import { noorCancelAction, noorQuoteAction, noorSendAction, noorTrackAction } from "./actions";

type Quote = { price: number; distanceKm: number | null; eta: string | null; outOfZone: boolean };

export function NoorPanel({
  orderId,
  ext,
  unpaid,
  onExt,
}: {
  orderId: string;
  ext: Record<string, string>;
  unpaid: boolean;
  onExt: (patch: Record<string, string>) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cod, setCod] = useState(unpaid);
  const [quote, setQuote] = useState<Quote | null>(null);
  const stage = ext.noor_stage ? Number(ext.noor_stage) : null;
  const active = !!ext.noor && stage !== null && stage < 21;
  const btn = "rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      await fn();
    });

  return (
    <div className="space-y-2 rounded-md border border-line bg-surface/50 p-2.5 text-xs">
      <p className="font-semibold">🛵 Noor (shahar ichida)</p>
      {ext.noor && (
        <div className="space-y-0.5">
          <p>
            Holat: <b>{stage ? (NOOR_STAGE_UZ[stage] ?? stage) : "—"}</b>
            {ext.noor_display && <span className="text-muted"> · №{ext.noor_display}</span>}
          </p>
          {ext.noor_price && <p>Narx: {formatMoney(Number(ext.noor_price))}</p>}
          {ext.noor_courier && <p>Kuryer: {ext.noor_courier}</p>}
          {ext.noor_link && (
            <a href={ext.noor_link} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              Kuzatish ↗
            </a>
          )}
        </div>
      )}

      {!active && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} />
            Mahsulot pulini kuryer mijozdan olsin
          </label>
          {quote && (
            <p className="rounded bg-white p-2">
              Narx: <b>{formatMoney(quote.price)}</b>
              {quote.distanceKm ? ` · ${quote.distanceKm} km` : ""}
              {quote.outOfZone && <span className="block text-red-600">⚠️ Manzil Noor hududidan tashqarida</span>}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={pending}
              className={`${btn} bg-white text-ink hover:bg-surface`}
              onClick={() =>
                run(async () => {
                  const r = await noorQuoteAction(orderId, cod);
                  if (r.ok) setQuote(r.data);
                  else setError(r.error);
                })
              }
            >
              Narxni hisoblash
            </button>
            {quote && !quote.outOfZone && (
              <button
                type="button"
                disabled={pending}
                className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}
                onClick={() => {
                  if (!window.confirm(`Noor kuryeri chaqirilsinmi? Narx: ${formatMoney(quote.price)}`)) return;
                  run(async () => {
                    const r = await noorSendAction(orderId, cod);
                    if (r.ok) {
                      onExt({
                        noor: String(r.data.noorId),
                        noor_stage: String(r.data.stage),
                        ...(r.data.display ? { noor_display: String(r.data.display) } : {}),
                        ...(r.data.price ? { noor_price: String(r.data.price) } : {}),
                        ...(r.data.link ? { noor_link: r.data.link } : {}),
                      });
                      setQuote(null);
                    } else setError(r.error);
                  });
                }}
              >
                Kuryer chaqirish
              </button>
            )}
          </div>
        </div>
      )}

      {ext.noor && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={pending}
            className={`${btn} bg-white text-ink hover:bg-surface`}
            onClick={() =>
              run(async () => {
                const r = await noorTrackAction(orderId);
                if (r.ok) onExt({ noor_stage: String(r.data.stage), ...(r.data.courier ? { noor_courier: r.data.courier } : {}) });
                else setError(r.error);
              })
            }
          >
            Holatni yangilash
          </button>
          {stage !== null && NOOR_CANCELLABLE(stage) && (
            <button
              type="button"
              disabled={pending}
              className={`${btn} bg-white text-red-600 hover:bg-red-50`}
              onClick={() => {
                if (!window.confirm("Noor kuryer chaqiruvi bekor qilinsinmi?")) return;
                run(async () => {
                  const r = await noorCancelAction(orderId);
                  if (r.ok) onExt({ noor_stage: "22" });
                  else setError(r.error);
                });
              }}
            >
              Bekor qilish
            </button>
          )}
        </div>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
