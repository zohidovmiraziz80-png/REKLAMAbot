"use client";

import { useState, useTransition } from "react";
import type { AbandonSettings } from "@/actions/marketing";
import { saveAbandonAction } from "./actions";

export function Abandoned({ initial }: { initial: AbandonSettings }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [hours, setHours] = useState(initial.hours);
  const [text, setText] = useState(initial.text);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-semibold">🛒 Tashlab ketilgan savat</h2>
        <p className="mt-0.5 text-sm text-muted">
          Telegram orqali kirgan mijoz savatga mahsulot qo&apos;shib, buyurtma bermasa — bot unga bir marta eslatma yuboradi (mahsulotlar ro&apos;yxati va «Buyurtmani yakunlash» tugmasi bilan).
        </p>
      </div>
      {!initial.hasBot ? (
        <p className="text-sm text-muted">Avval Telegram botni ulang.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Eslatmani yoqish
          </label>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Qachon</span>
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm">
                {[1, 2, 3, 6, 12, 24].map((h) => (
                  <option key={h} value={h}>
                    {h} soatdan keyin
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Qo&apos;shimcha matn (ixtiyoriy)</span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                placeholder="🎁 Bugun buyurtma bersangiz — QAYT10 promo-kodi bilan 10% chegirma!"
                className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
          <p className="text-xs text-muted">Hozir saqlangan savatlar: {initial.waiting}. Tekshiruv har 30 daqiqada ishlaydi.</p>
          {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveAbandonAction({ enabled, hours, text });
                setMsg(r.ok ? { ok: true, text: "Saqlandi ✓" } : { ok: false, text: r.error });
              })
            }
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Saqlash
          </button>
        </>
      )}
    </section>
  );
}
