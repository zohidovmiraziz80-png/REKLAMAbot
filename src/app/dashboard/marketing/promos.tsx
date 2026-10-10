"use client";

import { useState, useTransition } from "react";
import type { PromoRow } from "@/lib/shop/promo";
import { formatMoney } from "@/lib/shop/format";
import { deletePromoAction, savePromoAction, setPromoActiveAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function Promos({ ready, promos }: { ready: boolean; promos: PromoRow[] }) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({ code: "", kind: "percent" as "percent" | "fixed", value: "10", minOrder: "", maxUses: "", expiresAt: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-semibold">🎁 Promo-kodlar</h2>
        <p className="mt-0.5 text-sm text-muted">Mijoz savatda kodni kiritadi — chegirma mahsulotlar summasidan hisoblanadi.</p>
      </div>
      {!ready ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Promo-kodlar uchun bazani yangilash kerak: Vercel → Supabase → Query oynasida tayyor SQL&apos;ni ishga tushiring (Read-only → Disable → Run).
        </p>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                setMsg(null);
                const r = await savePromoAction({
                  code: f.code,
                  kind: f.kind,
                  value: Number(f.value) || 0,
                  minOrder: Number(f.minOrder) || 0,
                  maxUses: f.maxUses ? Number(f.maxUses) : null,
                  expiresAt: f.expiresAt || null,
                });
                if (r.ok) {
                  setMsg({ ok: true, text: "Promo-kod yaratildi ✓" });
                  setF((x) => ({ ...x, code: "" }));
                } else setMsg({ ok: false, text: r.error });
              });
            }}
            className="grid gap-3 sm:grid-cols-3"
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Kod</span>
              <input value={f.code} onChange={(e) => setF((x) => ({ ...x, code: e.target.value.toUpperCase() }))} placeholder="YANGI10" className={`${input} font-mono`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Chegirma</span>
              <div className="flex gap-2">
                <input value={f.value} onChange={set("value")} inputMode="numeric" className={input} />
                <select value={f.kind} onChange={set("kind")} className={`${input} w-24`}>
                  <option value="percent">%</option>
                  <option value="fixed">so&apos;m</option>
                </select>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Minimal xarid (so&apos;m)</span>
              <input value={f.minOrder} onChange={set("minOrder")} inputMode="numeric" placeholder="0" className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Necha marta ishlatiladi</span>
              <input value={f.maxUses} onChange={set("maxUses")} inputMode="numeric" placeholder="cheksiz" className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Amal qilish muddati</span>
              <input type="date" value={f.expiresAt} onChange={set("expiresAt")} className={input} />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={pending || !f.code} className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                + Yaratish
              </button>
            </div>
          </form>
          {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
          {promos.length === 0 ? (
            <p className="text-sm text-muted">Hali promo-kod yo&apos;q.</p>
          ) : (
            <ul className="divide-y divide-line">
              {promos.map((p) => {
                const expired = p.expires_at && new Date(p.expires_at).getTime() < Date.now();
                const exhausted = p.max_uses !== null && p.used_count >= p.max_uses;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="rounded-md bg-surface px-2 py-1 font-mono font-semibold">{p.code}</span>
                    <span className="font-medium">{p.kind === "percent" ? `-${p.value}%` : `-${formatMoney(p.value)}`}</span>
                    <span className="min-w-0 flex-1 text-xs text-muted">
                      {p.min_order ? `${formatMoney(p.min_order)} dan · ` : ""}
                      ishlatilgan: {p.used_count}
                      {p.max_uses ? `/${p.max_uses}` : ""}
                      {p.expires_at ? ` · ${new Date(p.expires_at).toLocaleDateString("ru-RU")} gacha` : ""}
                    </span>
                    {expired || exhausted ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{expired ? "Muddati tugagan" : "Limit tugagan"}</span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => start(async () => void (await setPromoActiveAction(p.id, !p.active)))}
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {p.active ? "Faol" : "O'chirilgan"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`${p.code} o'chirilsinmi?`)) return;
                        start(async () => void (await deletePromoAction(p.id)));
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      O&apos;chirish
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
