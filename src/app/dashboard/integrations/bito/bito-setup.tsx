"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BitoSetup } from "@/actions/integrations";
import { formatDateTime } from "@/lib/shop/format";
import { connectBitoAction, disconnectBitoAction, saveBitoSettingsAction, syncBitoAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function BitoConnect() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Kalitni qayerdan olaman?</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Bito chap menyusida <b>Integratsiyalar → Integratsiyalar</b> ni oching.
          </li>
          <li>
            <b>Custom integratsiya</b> → <b>Tashqi integratsiya</b> qatorida <b>+ Yaratish</b> → nom yozing (masalan &quot;TezDo&apos;kon&quot;) → <b>Saqlash</b>.
          </li>
          <li>
            Chiqqan oynadagi <b>API Key</b> ni nusxalang (<code className="rounded bg-surface px-1">login:kalit</code> ko&apos;rinishida). Client ID va Secret kerak emas.
          </li>
          <li>
            <b>Muhim:</b> Integratsiyalar sahifasida <b>O&apos;rnatilgan</b> ro&apos;yxatidan yangi integratsiyani ochib <b>O&apos;rnatish</b> tugmasini bosing. Busiz kalit ishlamaydi.
          </li>
          <li>Kalitni pastdagi maydonga joylang va &quot;Ulash&quot;ni bosing.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">Kalit faqat serverda shifrlangan holda saqlanadi, keyin hech kimga (sizga ham) ko&apos;rsatilmaydi.</p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const r = await connectBitoAction(key);
            if (r.ok) {
              setKey("");
              router.refresh();
            } else setError(r.error);
          });
        }}
        className="space-y-3 rounded-2xl border border-line bg-white p-5"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Bito API kaliti</span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="username:secret"
            className={`${input} font-mono`}
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={pending || key.trim().length < 5}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Tekshirilmoqda…" : "Ulash"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function BitoSettingsPanel({ setup }: { setup: BitoSetup }) {
  const s = setup.settings!;
  const o = setup.options;
  const sum = setup.summary;
  const router = useRouter();
  const [form, setForm] = useState({
    organizationId: s.organizationId,
    priceId: s.priceId,
    warehouseId: s.warehouseId,
    responsibleId: s.responsibleId,
    syncProducts: s.syncProducts,
    sendOrders: s.sendOrders,
    onlyInStock: s.onlyInStock,
    orderState: s.orderState,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [syncing, startSync] = useTransition();
  const [removing, startRemove] = useTransition();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const warehouses = (o?.warehouses ?? []).filter((w) => !w.organization_id || !form.organizationId || w.organization_id === form.organizationId);

  function save(after?: () => void) {
    startSave(async () => {
      setMsg(null);
      const r = await saveBitoSettingsAction(form);
      setMsg(r.ok ? { ok: true, text: "Saqlandi" } : { ok: false, text: r.error });
      if (r.ok) after?.();
    });
  }

  function sync() {
    startSync(async () => {
      setSyncMsg(null);
      const saved = await saveBitoSettingsAction(form);
      if (!saved.ok) {
        setSyncMsg({ ok: false, text: saved.error });
        return;
      }
      const r = await syncBitoAction();
      if (r.ok) {
        setSyncMsg({
          ok: true,
          text: `Tayyor: ${r.data.total} ta mahsulot olindi, ${r.data.active} tasi sotuvda${r.data.withoutPrice ? `, ${r.data.withoutPrice} tasida narx yo'q` : ""}.`,
        });
        router.refresh();
      } else setSyncMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">
              {sum?.status === "error" ? "⚠️ Ulanishda xato" : "✅ Bito ulangan"}
              {sum?.keyHint && <span className="ml-2 font-mono text-xs font-normal text-muted">kalit {sum.keyHint}</span>}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {setup.linkedProducts} ta mahsulot Bito bilan bog&apos;langan · oxirgi yangilanish: {sum?.lastSyncAt ? formatDateTime(sum.lastSyncAt) : "hali yo'q"}
            </p>
          </div>
          <button
            type="button"
            disabled={syncing || !form.organizationId || !form.priceId}
            onClick={sync}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {syncing ? "Yangilanmoqda… (1–3 daqiqa)" : "🔄 Mahsulotlarni hozir yangilash"}
          </button>
        </div>
        {syncMsg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${syncMsg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{syncMsg.text}</p>}
        {!syncMsg && sum?.lastError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Oxirgi xato: {sum.lastError}</p>}
        {sum?.status === "error" && (
          <p className="mt-2 text-sm text-muted">Kalit o&apos;zgargan bo&apos;lsa — pastda &quot;Uzish&quot;ni bosib, yangi kalit bilan qayta ulang.</p>
        )}
        {setup.linkedProducts > 0 && (
          <Link href="/dashboard/products" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
            Mahsulotlarni ko&apos;rish →
          </Link>
        )}
      </section>

      {setup.optionsError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Bito&apos;dan ro&apos;yxatlarni olib bo&apos;lmadi: {setup.optionsError}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-5 rounded-2xl border border-line bg-white p-5"
      >
        <h2 className="font-semibold">Sozlamalar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Filial (tashkilot)">
            <select value={form.organizationId} onChange={(e) => set("organizationId", e.target.value)} className={input}>
              <option value="">— tanlang —</option>
              {o?.organizations.map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Narx turi" hint="Saytda shu narx ko'rsatiladi">
            <select value={form.priceId} onChange={(e) => set("priceId", e.target.value)} className={input}>
              <option value="">— tanlang —</option>
              {o?.prices.map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ombor" hint="Qoldiq shu ombordan olinadi, buyurtma shu omborga yoziladi">
            <select value={form.warehouseId} onChange={(e) => set("warehouseId", e.target.value)} className={input}>
              <option value="">— filial bo&apos;yicha umumiy —</option>
              {warehouses.map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mas'ul xodim" hint="Bito'dagi buyurtmalar shu xodimga biriktiriladi">
            <select value={form.responsibleId} onChange={(e) => set("responsibleId", e.target.value)} className={input}>
              <option value="">— tanlang —</option>
              {o?.employees.map((x) => (
                <option key={x._id} value={x._id}>
                  {x.full_name || x._id}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <Toggle
            checked={form.syncProducts}
            onChange={(v) => set("syncProducts", v)}
            label="Mahsulotlarni Bito'dan olish"
            hint="Nomi, narxi, qoldig'i, kategoriyasi va rasmi. Sayt ochilganda har 3 soatda avtomatik yangilanadi."
          />
          <Toggle
            checked={form.onlyInStock}
            onChange={(v) => set("onlyInStock", v)}
            label="Faqat qoldig'i bor mahsulotlarni ko'rsatish"
            hint="Qoldig'i 0 bo'lganlar saytda yashiriladi"
          />
          <Toggle
            checked={form.sendOrders}
            onChange={(v) => set("sendOrders", v)}
            label="Buyurtmalarni Bito'ga yuborish"
            hint="Mijoz telefon raqami bo'yicha topiladi yoki yangi mijoz yaratiladi, keyin sotuv buyurtmasi ochiladi"
          />
          {form.sendOrders && (
            <Field label="Bito'dagi buyurtma holati">
              <select value={form.orderState} onChange={(e) => set("orderState", e.target.value as typeof form.orderState)} className={`${input} sm:max-w-xs`}>
                <option value="new">Yangi</option>
                <option value="draft">Qoralama</option>
                <option value="in_progress">Jarayonda</option>
              </select>
            </Field>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line pt-4">
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </form>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Uzish</h2>
        <p className="mt-1 text-sm text-muted">Kalit o&apos;chiriladi. Olingan mahsulotlar va buyurtmalar saqlanib qoladi.</p>
        <button
          type="button"
          disabled={removing}
          onClick={() => {
            if (!window.confirm("Bito uzilsinmi?")) return;
            startRemove(async () => {
              const r = await disconnectBitoAction();
              if (r.ok) router.refresh();
              else setMsg({ ok: false, text: r.error });
            });
          }}
          className="mt-3 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Bito&apos;ni uzish
        </button>
      </section>
    </div>
  );
}
