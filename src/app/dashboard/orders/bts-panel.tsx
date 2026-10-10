"use client";

import { useEffect, useState, useTransition } from "react";
import { BTS_STATUS_UZ } from "@/lib/delivery/bts-status";
import { formatMoney } from "@/lib/shop/format";
import { btsCancelAction, btsDirectoryAction, btsEstimateAction, btsSendAction, btsTrackAction } from "./actions";

type Item = { code: string; name: string };
const sel = "w-full rounded border border-line bg-white px-2 py-1 text-xs";

export function BtsPanel({
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
  const [open, setOpen] = useState(false);
  const [regions, setRegions] = useState<Item[]>([]);
  const [cities, setCities] = useState<Item[]>([]);
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [dropoff, setDropoff] = useState<"courier" | "branch">("courier");
  const [weight, setWeight] = useState("1");
  const [cod, setCod] = useState(unpaid);
  const [quote, setQuote] = useState<{ courier: number | null; branch: number | null } | null>(null);
  const code = ext.bts_status ? Number(ext.bts_status) : null;
  const sent = !!ext.bts && code !== 1300 && code !== 1400;
  const btn = "rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

  useEffect(() => {
    if (open && !regions.length) btsDirectoryAction().then((r) => (r.ok ? setRegions(r.data) : setError(r.error)));
  }, [open, regions.length]);
  useEffect(() => {
    setCity("");
    setQuote(null);
    if (!region) return setCities([]);
    btsDirectoryAction(region).then((r) => (r.ok ? setCities(r.data) : setError(r.error)));
  }, [region]);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      await fn();
    });

  return (
    <div className="space-y-2 rounded-md border border-line bg-surface/50 p-2.5 text-xs">
      <p className="font-semibold">📦 BTS (viloyatlarga)</p>
      {ext.bts && (
        <div className="space-y-0.5">
          <p>
            Holat: <b>{code ? (BTS_STATUS_UZ[code] ?? code) : "—"}</b>
          </p>
          {ext.bts_barcode && <p>Trek: {ext.bts_barcode}</p>}
          {ext.bts_cost && <p>Narx: {formatMoney(Number(ext.bts_cost))}</p>}
          {ext.bts_tracking && (
            <a href={ext.bts_tracking} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              Kuzatish ↗
            </a>
          )}
        </div>
      )}

      {!sent && !open && (
        <button type="button" onClick={() => setOpen(true)} className={`${btn} bg-white text-ink hover:bg-surface`}>
          BTS&apos;ga jo&apos;natish
        </button>
      )}

      {!sent && open && (
        <div className="space-y-1.5">
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={sel}>
            <option value="">Viloyat…</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setQuote(null);
            }}
            className={sel}
            disabled={!cities.length}
          >
            <option value="">Shahar / tuman…</option>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <select value={dropoff} onChange={(e) => setDropoff(e.target.value as "courier" | "branch")} className={sel}>
              <option value="courier">Uyigacha (kuryer)</option>
              <option value="branch">Filialdan oladi</option>
            </select>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className={`${sel} w-16`} title="Og'irlik, kg" />
          </div>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} />
            Pulni BTS yig&apos;ib bersin (naqd to&apos;lov)
          </label>
          {quote && (
            <p className="rounded bg-white p-2">
              Uyigacha: <b>{quote.courier ? formatMoney(quote.courier) : "—"}</b> · Filialgacha: <b>{quote.branch ? formatMoney(quote.branch) : "—"}</b>
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={pending || !city}
              className={`${btn} bg-white text-ink hover:bg-surface`}
              onClick={() =>
                run(async () => {
                  const r = await btsEstimateAction(city, Number(weight) || undefined);
                  if (r.ok) setQuote(r.data);
                  else setError(r.error);
                })
              }
            >
              Narxni hisoblash
            </button>
            {quote && (
              <button
                type="button"
                disabled={pending}
                className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}
                onClick={() => {
                  const price = dropoff === "courier" ? quote.courier : quote.branch;
                  if (!window.confirm(`BTS'ga jo'natilsinmi?${price ? ` Narx: ${formatMoney(price)}` : ""}`)) return;
                  run(async () => {
                    const r = await btsSendAction({ orderId, receiverCityCode: city, dropoff, weight: Number(weight) || undefined, cod });
                    if (r.ok) {
                      onExt({
                        bts: String(r.data.btsOrderId),
                        bts_status: "100",
                        ...(r.data.barcode ? { bts_barcode: r.data.barcode } : {}),
                        ...(r.data.cost ? { bts_cost: String(r.data.cost) } : {}),
                        ...(r.data.tracking ? { bts_tracking: r.data.tracking } : {}),
                      });
                      setOpen(false);
                    } else setError(r.error);
                  });
                }}
              >
                Jo&apos;natish
              </button>
            )}
          </div>
        </div>
      )}

      {ext.bts && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={pending}
            className={`${btn} bg-white text-ink hover:bg-surface`}
            onClick={() =>
              run(async () => {
                const r = await btsTrackAction(orderId);
                if (r.ok) onExt({ bts_status: String(r.data) });
                else setError(r.error);
              })
            }
          >
            Holatni yangilash
          </button>
          {code === 100 && (
            <button
              type="button"
              disabled={pending}
              className={`${btn} bg-white text-red-600 hover:bg-red-50`}
              onClick={() => {
                if (!window.confirm("BTS jo'natmasi bekor qilinsinmi?")) return;
                run(async () => {
                  const r = await btsCancelAction(orderId);
                  if (r.ok) onExt({ bts_status: "1300" });
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
