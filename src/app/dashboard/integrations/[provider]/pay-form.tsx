"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PaySetup } from "@/actions/integrations";
import { connectPayAction, disconnectPayAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

type Field = { key: string; label: string; placeholder?: string; hint?: string };

const CONFIG: Record<
  PaySetup["provider"],
  { fields: Field[]; secretLabel: string; secretHint: string; test: boolean; steps: React.ReactNode[] }
> = {
  payme: {
    fields: [{ key: "merchantId", label: "Merchant ID (kassa ID)", placeholder: "24 belgili, masalan 67fcb49c8d2f...", hint: "Kabinet → Kassa → Sozlamalar → Ma'lumotlar" }],
    secretLabel: "Kalit (Key)",
    secretHint: "Kassa → Sozlamalar → Kalitlar. Test rejimida — test kalit, ishchi rejimda — ishchi kalit.",
    test: true,
    steps: [
      <>merchant.payme.uz → kassangizni oching → <b>Sozlamalar</b>.</>,
      <><b>Endpoint (to&apos;lov qabul qilish manzili)</b> maydoniga pastdagi manzilni qo&apos;ying.</>,
      <><b>Hisob (account) maydoni</b>: kalit nomi <code className="rounded bg-surface px-1">order_id</code>, turi — matn.</>,
      <>Merchant ID va kalitni shu sahifaga kiriting va <b>Saqlash</b>ni bosing.</>,
      <>Payme kabinetidagi <b>Test</b> bo&apos;limida sinab ko&apos;ring, keyin kassani ishchi rejimga o&apos;tkazing.</>,
    ],
  },
  click: {
    fields: [
      { key: "serviceId", label: "Service ID", placeholder: "masalan 12345" },
      { key: "merchantId", label: "Merchant ID", placeholder: "masalan 6789" },
      { key: "merchantUserId", label: "Merchant User ID (ixtiyoriy)", placeholder: "masalan 10101" },
    ],
    secretLabel: "Secret key",
    secretHint: "Kabinet → Servis → Sozlamalar → Secret key",
    test: false,
    steps: [
      <>mc.click.uz → <b>Servislar</b> → servisingizni oching.</>,
      <><b>Prepare URL</b> va <b>Complete URL</b> maydonlarining ikkalasiga ham pastdagi manzilni qo&apos;ying.</>,
      <>Service ID, Merchant ID va Secret key&apos;ni shu sahifaga kiriting va <b>Saqlash</b>ni bosing.</>,
    ],
  },
  multicard: {
    fields: [
      { key: "storeId", label: "Store ID (kassa ID)", placeholder: "masalan 6" },
      { key: "applicationId", label: "Application ID", placeholder: "masalan mystore_app" },
    ],
    secretLabel: "Secret",
    secretHint: "Multicard kabinetidagi integratsiya (API) bo'limi",
    test: true,
    steps: [
      <>merchant.multicard.uz → integratsiya / API bo&apos;limidan <b>Application ID</b>, <b>Secret</b> va <b>Store ID</b>ni oling.</>,
      <>Callback manzili har bir to&apos;lovda avtomatik yuboriladi — kabinetda alohida sozlash shart emas (so&apos;ralsa, pastdagi manzilni qo&apos;ying).</>,
      <>Ma&apos;lumotlarni shu sahifaga kiriting va <b>Saqlash</b>ni bosing.</>,
    ],
  },
};

export function PayForm({ setup }: { setup: PaySetup }) {
  const cfg = CONFIG[setup.provider];
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(cfg.fields.map((f) => [f.key, String(setup.settings?.[f.key] ?? "")])),
  );
  const [testMode, setTestMode] = useState(Boolean(setup.settings?.testMode));
  const [secret, setSecret] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Qanday ulanadi</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          {cfg.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <div className="mt-4">
          <span className="mb-1 block text-xs font-medium text-muted">Sizning manzilingiz (callback / endpoint)</span>
          <div className="flex gap-2">
            <code className="block flex-1 truncate rounded-lg bg-surface px-3 py-2 font-mono text-sm select-all">{setup.callbackUrl}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(setup.callbackUrl).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface"
            >
              {copied ? "Nusxalandi ✓" : "Nusxalash"}
            </button>
          </div>
        </div>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setMsg(null);
            const settings: Record<string, unknown> = { ...values };
            if (cfg.test) settings.testMode = testMode;
            const r = await connectPayAction(setup.provider, settings, secret);
            if (r.ok) {
              setSecret("");
              setMsg({ ok: true, text: "Saqlandi. Endi saytda bu to'lov usuli chiqadi." });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          });
        }}
        className="space-y-4 rounded-2xl border border-line bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ma&apos;lumotlar</h2>
          {setup.connected && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${setup.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {setup.status === "active" ? "Ulangan" : "Xato"}
            </span>
          )}
        </div>
        {cfg.fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium">{f.label}</span>
            <input value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} className={`${input} font-mono`} />
            {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{cfg.secretLabel}</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={setup.keyHint ? `Saqlangan (${setup.keyHint}) — o'zgartirish uchun yangisini kiriting` : "Kalitni joylang"}
            className={`${input} font-mono`}
          />
          <span className="mt-1 block text-xs text-muted">{cfg.secretHint}. Kalit shifrlanib saqlanadi va hech kimga ko&apos;rsatilmaydi.</span>
        </label>
        {cfg.test && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
            Test rejimi (haqiqiy pul yechilmaydi)
          </label>
        )}
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </form>

      {setup.connected && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Uzish</h2>
          <p className="mt-1 text-sm text-muted">Saytda bu to&apos;lov usuli ko&apos;rinmay qoladi. Oldingi to&apos;lovlar saqlanadi.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Uzilsinmi?")) return;
              start(async () => {
                const r = await disconnectPayAction(setup.provider);
                if (r.ok) router.refresh();
                else setMsg({ ok: false, text: r.error });
              });
            }}
            className="mt-3 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Uzish
          </button>
        </section>
      )}
    </div>
  );
}
