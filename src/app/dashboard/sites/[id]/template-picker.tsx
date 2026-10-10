"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TEMPLATE_LIST, type TemplateId } from "@/lib/site/templates";
import { createFromTemplateAction } from "./actions";

const inputCls =
  "block w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export function TemplatePicker({
  projectId,
  defaultName,
  aiEnabled,
  replacing = false,
}: {
  projectId: string;
  defaultName: string;
  aiEnabled: boolean;
  /** Mavjud saytni yangi shablon bilan almashtirish */
  replacing?: boolean;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<TemplateId>("market");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const fd = new FormData(e.currentTarget);
    const details: Record<string, string> = {};
    for (const key of ["businessName", "phone", "telegram", "instagram", "address"]) {
      details[key] = String(fd.get(key) ?? "");
    }
    startTransition(async () => {
      const result = await createFromTemplateAction(projectId, templateId, details);
      if (result.ok) {
        if (replacing) router.push(`/dashboard/sites/${projectId}`);
        router.refresh();
      }
      else setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-line bg-white p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{replacing ? "Shablonni almashtirish" : "Saytingizni yarating"}</h1>
        <p className="mt-1 text-muted">Shablonni tanlang va asosiy ma&apos;lumotlarni kiriting. Keyin har bir matn, rang va bo&apos;limni o&apos;zingiz tahrirlaysiz.</p>
      </div>

      {replacing && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <span>⚠️ Yangi shablon hozirgi saytning sahifalari va matnlari o&apos;rniga qo&apos;yiladi. Mahsulotlar, buyurtmalar va sozlamalar o&apos;zgarmaydi.</span>
          <Link href={`/dashboard/sites/${projectId}`} className="font-semibold underline">
            Bekor qilish
          </Link>
        </div>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">1. Shablon</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATE_LIST.map((t) => {
            const active = t.id === templateId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                aria-pressed={active}
                className={`overflow-hidden rounded-xl border text-left transition ${active ? "border-brand-500 ring-4 ring-brand-100" : "border-line hover:border-brand-500"}`}
              >
                <div className="flex h-20 items-center justify-between px-4" style={{ background: t.theme.primary }}>
                  <span className="text-3xl">{t.emoji}</span>
                  <span className="h-6 w-16 rounded-full" style={{ background: t.theme.accent, borderRadius: t.theme.radius === "sharp" ? 4 : 999 }} />
                </div>
                <div className="px-4 py-3">
                  <p className="font-semibold">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">2. Ma&apos;lumotlar</legend>
        <label className="block">
          <span className="mb-1.5 block text-sm">Biznes nomi</span>
          <input name="businessName" required maxLength={60} defaultValue={defaultName} className={inputCls} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="phone" type="tel" inputMode="tel" placeholder="Telefon: +998 90 123 45 67" maxLength={30} className={inputCls} />
          <input name="telegram" placeholder="Telegram: @username" maxLength={64} className={inputCls} />
          <input name="instagram" placeholder="Instagram: @username" maxLength={64} className={inputCls} />
          <input name="address" placeholder="Manzil" maxLength={200} className={inputCls} />
        </div>
        <p className="text-xs text-muted">Aloqa ma&apos;lumotlari ixtiyoriy — keyin ham qo&apos;shish mumkin.</p>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent-500 px-4 py-3 text-[15px] font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {pending ? "Yaratilmoqda..." : "Saytni yaratish"}
      </button>

      {aiEnabled && (
        <p className="text-center text-sm text-muted">
          yoki{" "}
          <Link href={`/dashboard/sites/${projectId}?mode=ai`} className="font-medium text-brand-600 hover:underline">
            ⚡ AI bilan yaratish
          </Link>
        </p>
      )}
    </form>
  );
}
