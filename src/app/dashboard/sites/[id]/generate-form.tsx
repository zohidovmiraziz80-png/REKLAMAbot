"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { generateWebsiteAction } from "./actions";

const STYLES = [
  { value: "modern", label: "Zamonaviy", hint: "Toza, ko'p bo'sh joy" },
  { value: "classic", label: "Klassik", hint: "Jiddiy va ishonchli" },
  { value: "bright", label: "Yorqin", hint: "Quvnoq, energiyali" },
  { value: "minimal", label: "Minimal", hint: "Oddiy, kam rang" },
] as const;

const LOADING_STEPS = [
  "Biznesingizni o'rganyapman...",
  "Sahifa tuzilmasini rejalashtiryapman...",
  "Sarlavha va matnlarni yozyapman...",
  "Ranglar va uslubni tanlayapman...",
  "Mahsulotlar bo'limini tayyorlayapman...",
  "Oxirgi tekshiruv...",
];

const inputCls =
  "block w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export function GenerateForm({ projectId, defaultName }: { projectId: string; defaultName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!pending) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 7000);
    return () => clearInterval(t);
  }, [pending]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const fd = new FormData(e.currentTarget);
    const brief: Record<string, string> = {};
    fd.forEach((v, k) => (brief[k] = String(v)));
    startTransition(async () => {
      const result = await generateWebsiteAction(projectId, brief);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  if (pending) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white px-6 py-16 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-100 border-t-accent-500" />
        <p className="mt-6 text-lg font-semibold">AI saytingizni yaratmoqda</p>
        <p className="mt-2 text-muted" aria-live="polite">
          {LOADING_STEPS[step]}
        </p>
        <p className="mt-6 text-xs text-muted">Odatda 20–60 soniya davom etadi. Sahifani yopmang.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-line bg-white p-6 sm:p-8">
      <div>
        <p className="inline-block rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-600">⚡ AI bilan sayt</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Biznesingiz haqida yozing</h1>
        <p className="mt-1 text-muted">AI sahifalar, matnlar va dizaynni tayyorlaydi. Keyin hammasini o&apos;zingiz tahrirlaysiz.</p>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Biznes nomi</span>
        <input name="businessName" required maxLength={60} defaultValue={defaultName} className={inputCls} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Nima sotasiz yoki qanday xizmat ko&apos;rsatasiz?</span>
        <textarea
          name="description"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          placeholder="Masalan: Toshkentda ayollar kiyimlari do'koni. Ko'ylak, kostyum va sumkalar. Yetkazib berish shahar bo'ylab 1 kunda. Ko'ylaklar 250 000 so'mdan."
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-muted">Qancha aniq yozsangiz, sayt shuncha yaxshi chiqadi. Narxlarni yozsangiz, saytga qo&apos;shiladi.</span>
      </label>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Uslub</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STYLES.map((s, i) => (
            <label
              key={s.value}
              className="cursor-pointer rounded-lg border border-line px-3 py-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
            >
              <input type="radio" name="style" value={s.value} defaultChecked={i === 0} className="sr-only" />
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="block text-xs text-muted">{s.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Sayt tili</span>
        <select name="language" defaultValue="uz" className={inputCls}>
          <option value="uz">O&apos;zbekcha</option>
          <option value="ru">Ruscha</option>
          <option value="en">Inglizcha</option>
        </select>
      </label>

      <div>
        <p className="mb-1.5 text-sm font-medium">
          Aloqa ma&apos;lumotlari <span className="font-normal text-muted">(ixtiyoriy — AI ularni o&apos;ylab topmaydi)</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="phone" type="tel" placeholder="Telefon: +998 90 123 45 67" maxLength={30} className={inputCls} />
          <input name="telegram" placeholder="Telegram: @username" maxLength={64} className={inputCls} />
          <input name="instagram" placeholder="Instagram: @username" maxLength={64} className={inputCls} />
          <input name="address" placeholder="Manzil" maxLength={200} className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-accent-500 px-4 py-3 text-[15px] font-semibold text-white hover:bg-accent-600"
      >
        ⚡ Saytni yaratish
      </button>
    </form>
  );
}
