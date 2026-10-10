"use client";

import { useState, useTransition } from "react";
import type { AiSettings } from "@/actions/ai-assistant";
import { saveAiSettingsAction } from "./actions";

function Toggle({ id, title, text, checked, onChange }: { id: string; title: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label id={id} className="flex scroll-mt-6 items-start gap-4 rounded-2xl border border-line bg-white p-5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5" />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{text}</span>
      </span>
    </label>
  );
}

export function AiForm({ initial }: { initial: AiSettings }) {
  const [aiBot, setAiBot] = useState(initial.aiBot);
  const [aiSite, setAiSite] = useState(initial.aiSite);
  const [ins, setIns] = useState(initial.aiInstructions);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <Toggle
        id="bot"
        title="AI Telegram — botda javob berish"
        text="Mijoz menyudan tashqari savol yozsa, AI javob beradi. Xabar va javob Chat bo'limida saqlanadi, sizga ham keladi — xohlasangiz o'zingiz davom ettirasiz."
        checked={aiBot}
        onChange={setAiBot}
      />
      <Toggle
        id="site"
        title="SI konsultant — saytda chat oynasi"
        text="Saytning o'ng pastki burchagida 💬 tugmasi chiqadi: mijoz mahsulot so'raydi, AI mos variantlarni narxi bilan taklif qiladi."
        checked={aiSite}
        onChange={setAiSite}
      />
      <section className="space-y-2 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Qo&apos;shimcha ma&apos;lumot (ixtiyoriy)</h2>
        <p className="text-sm text-muted">AI mahsulotlar, narxlar va yetkazish sozlamalarini o&apos;zi biladi. Bu yerga boshqa muhim narsalarni yozing.</p>
        <textarea
          value={ins}
          onChange={(e) => setIns(e.target.value)}
          rows={6}
          maxLength={2000}
          placeholder={"Ish vaqti: har kuni 9:00–21:00\nManzil: Toshkent, Chilonzor 5\nSovg'a qadoqlash bepul\nQaytarish: 3 kun ichida, chek bilan\nMuloyim va qisqa javob ber"}
          className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </section>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveAiSettingsAction({ aiBot, aiSite, aiInstructions: ins });
            setMsg(r.ok ? { ok: true, text: "Saqlandi ✓ Botga savol yozib sinab ko'ring." } : { ok: false, text: r.error });
          })
        }
        className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Saqlanmoqda…" : "Saqlash"}
      </button>
      <p className="text-xs text-muted">AI ba&apos;zan xato qilishi mumkin: u faqat katalogdagi ma&apos;lumotni aytishga sozlangan, aniq bo&apos;lmasa operatorga yo&apos;naltiradi.</p>
    </div>
  );
}
