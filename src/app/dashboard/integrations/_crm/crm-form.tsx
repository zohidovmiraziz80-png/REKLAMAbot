"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CrmSetup } from "@/actions/crm";
import { connectCrmAction, disconnectCrmAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function CrmForm({ setup }: { setup: CrmSetup }) {
  const router = useRouter();
  const bx = setup.provider === "bitrix24";
  const s = setup.settings ?? {};
  const [mode, setMode] = useState(String(s.mode ?? "deal"));
  const [subdomain, setSubdomain] = useState(String(s.subdomain ?? ""));
  const [pipelineId, setPipelineId] = useState(String(s.pipelineId ?? ""));
  const [secret, setSecret] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Qanday ulanadi</h2>
        {bx ? (
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
            <li>
              Bitrix24 → <b>Разработчикам</b> (Developer resources) → <b>Другое</b> → <b>Входящий вебхук</b>.
            </li>
            <li>
              Ruxsatlar (права) ro&apos;yxatida <b>CRM (crm)</b> ni belgilang va saqlang.
            </li>
            <li>
              «Вебхук для вызова rest api» manzilini nusxalab (https://...bitrix24.../rest/1/.../) pastga o&apos;zingiz qo&apos;ying.
            </li>
          </ol>
        ) : (
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
            <li>
              AmoCRM → <b>amoМаркет</b> → ⋯ → <b>Создать интеграцию</b> → <b>Внешняя</b> (yoki Private), barcha ruxsatlarni bering.
            </li>
            <li>
              Integratsiya oynasi → <b>Ключи и доступы</b> → <b>Долгосрочный токен</b> → muddatini tanlab tokenni yarating.
            </li>
            <li>Tokenni va hisobingiz subdomenini (masalan mixpodarok.amocrm.ru → mixpodarok) pastga o&apos;zingiz kiriting.</li>
          </ol>
        )}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setMsg(null);
            const r = await connectCrmAction(setup.provider, bx ? { mode } : { subdomain, pipelineId }, secret);
            if (r.ok) {
              setSecret("");
              setMsg({ ok: true, text: "Ulandi va tekshirildi ✓ Keyingi buyurtmalar CRM'ga tushadi." });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          });
        }}
        className="space-y-4 rounded-2xl border border-line bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Sozlamalar</h2>
          {setup.connected && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${setup.lastError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
              {setup.lastError ? "Xato bor" : "Ulangan"}
            </span>
          )}
        </div>
        {!bx && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Subdomen</span>
              <input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="mixpodarok" className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Voronka ID (ixtiyoriy)</span>
              <input value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} inputMode="numeric" placeholder="asosiy voronka" className={input} />
            </label>
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{bx ? "Kiruvchi webhook manzili" : "Uzoq muddatli token"}</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            placeholder={setup.keyHint ? `Saqlangan (${setup.keyHint}) — o'zgartirish uchun yangisini kiriting` : bx ? "https://portal.bitrix24.uz/rest/1/abc123/" : "Tokenni joylang"}
            className={`${input} font-mono`}
          />
          <span className="mt-1 block text-xs text-muted">Shifrlanib saqlanadi va hech kimga ko&apos;rsatilmaydi.</span>
        </label>
        {bx && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Buyurtma qanday tushsin</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={input}>
              <option value="deal">Bitim (Сделка) + kontakt</option>
              <option value="lead">Lid (Лид)</option>
            </select>
          </label>
        )}
        {setup.lastError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Oxirgi xato: {setup.lastError}</p>}
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? "Tekshirilmoqda…" : "Saqlash va tekshirish"}
        </button>
      </form>

      {setup.connected && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Uzilsinmi?")) return;
            start(async () => {
              await disconnectCrmAction(setup.provider);
              router.refresh();
            });
          }}
          className="text-sm text-red-600 underline"
        >
          Uzish
        </button>
      )}
    </div>
  );
}
