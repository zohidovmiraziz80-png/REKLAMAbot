"use client";

import { useEffect, useState, useTransition } from "react";
import { FARGO_CANCELLABLE, FARGO_STATUS_UZ, fargoStage } from "@/lib/delivery/fargo-status";
import { formatMoney } from "@/lib/shop/format";
import { fargoCancelAction, fargoDirectoryAction, fargoEstimateAction, fargoSendAction, fargoTrackAction } from "./actions";

const sel = "w-full rounded border border-line bg-white px-2 py-1 text-xs";

export function FargoPanel({
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
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [toDoor, setToDoor] = useState(true);
  const [weight, setWeight] = useState("1");
  const [cod, setCod] = useState(unpaid);
  const [price, setPrice] = useState<number | null | undefined>(undefined);
  const code = ext.fargo_status ? Number(ext.fargo_status) : null;
  const sent = !!ext.fargo && code !== null && fargoStage(code) !== "cancelled";
  const btn = "rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

  useEffect(() => {
    if (open && !cities.length) fargoDirectoryAction().then((r) => (r.ok ? setCities(r.data) : setError(r.error)));
  }, [open, cities.length]);
  useEffect(() => {
    setDistrict("");
    setPrice(undefined);
    if (!city) return setDistricts([]);
    fargoDirectoryAction(city).then((r) => (r.ok ? setDistricts(r.data) : setError(r.error)));
  }, [city]);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      await fn();
    });

  return (
    <div className="space-y-2 rounded-md border border-line bg-surface/50 p-2.5 text-xs">
      <p className="font-semibold">🚚 Fargo (viloyatlarga)</p>
      {ext.fargo && (
        <div className="space-y-0.5">
          <p>
            Holat: <b>{code !== null ? (FARGO_STATUS_UZ[code] ?? code) : "—"}</b>
          </p>
          {ext.fargo_track && <p>Trek: {ext.fargo_track}</p>}
          {ext.fargo_price && <p>Narx: {formatMoney(Number(ext.fargo_price))}</p>}
        </div>
      )}

      {!sent && !open && (
        <button type="button" onClick={() => setOpen(true)} className={`${btn} bg-white text-ink hover:bg-surface`}>
          Fargo&apos;ga jo&apos;natish
        </button>
      )}

      {!sent && open && (
        <div className="space-y-1.5">
          <select value={city} onChange={(e) => setCity(e.target.value)} className={sel}>
            <option value="">Viloyat / shahar…</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setPrice(undefined);
            }}
            className={sel}
            disabled={!districts.length}
          >
            <option value="">Tuman…</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <select
              value={toDoor ? "door" : "branch"}
              onChange={(e) => {
                setToDoor(e.target.value === "door");
                setPrice(undefined);
              }}
              className={sel}
            >
              <option value="door">Uyigacha (kuryer)</option>
              <option value="branch">Filialdan oladi</option>
            </select>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className={`${sel} w-16`} title="Og'irlik, kg" />
          </div>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} />
            Mahsulot pulini Fargo yig&apos;ib bersin
          </label>
          {price !== undefined && <p className="rounded bg-white p-2">Narx: <b>{price ? formatMoney(price) : "jo'natishda aniqlanadi"}</b></p>}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={pending || !city}
              className={`${btn} bg-white text-ink hover:bg-surface`}
              onClick={() =>
                run(async () => {
                  const r = await fargoEstimateAction({ city, district, toDoor, weight: Number(weight) || undefined });
                  if (r.ok) setPrice(r.data.price);
                  else setError(r.error);
                })
              }
            >
              Narxni hisoblash
            </button>
            {price !== undefined && (
              <button
                type="button"
                disabled={pending}
                className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}
                onClick={() => {
                  if (!window.confirm(`Fargo'ga jo'natilsinmi?${price ? ` Narx: ${formatMoney(price)}` : ""}`)) return;
                  run(async () => {
                    const r = await fargoSendAction({ orderId, city, district, toDoor, weight: Number(weight) || undefined, cod });
                    if (r.ok) {
                      onExt({
                        fargo: String(r.data.fargoId),
                        fargo_status: "4",
                        ...(r.data.track ? { fargo_track: r.data.track } : {}),
                        ...(r.data.price ? { fargo_price: String(r.data.price) } : {}),
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

      {ext.fargo && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={pending}
            className={`${btn} bg-white text-ink hover:bg-surface`}
            onClick={() =>
              run(async () => {
                const r = await fargoTrackAction(orderId);
                if (r.ok) onExt({ fargo_status: String(r.data) });
                else setError(r.error);
              })
            }
          >
            Holatni yangilash
          </button>
          {code !== null && FARGO_CANCELLABLE(code) && (
            <button
              type="button"
              disabled={pending}
              className={`${btn} bg-white text-red-600 hover:bg-red-50`}
              onClick={() => {
                if (!window.confirm("Fargo jo'natmasi bekor qilinsinmi?")) return;
                run(async () => {
                  const r = await fargoCancelAction(orderId);
                  if (r.ok) onExt({ fargo_status: "512" });
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
