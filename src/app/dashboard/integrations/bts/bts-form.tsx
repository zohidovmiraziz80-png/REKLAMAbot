"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { BtsSetup } from "@/actions/delivery";
import { btsDirectoryAction, connectBtsAction, disconnectBtsAction, saveBtsSettingsAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

type Item = { code: string; name: string };

export function BtsForm({ setup }: { setup: BtsSetup }) {
  const router = useRouter();
  const s = setup.settings ?? {};
  const [baseUrl, setBaseUrl] = useState(s.baseUrl ?? "https://apitest.bts.uz:28345");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState({
    senderName: s.senderName ?? "",
    senderPhone: s.senderPhone ?? "+998",
    senderAddress: s.senderAddress ?? "",
    senderRegionCode: s.senderRegionCode ?? "",
    senderCityCode: s.senderCityCode ?? "",
    pickupType: s.pickupType ?? "courier",
    defaultWeight: String(s.defaultWeight ?? 1),
  });
  const [regions, setRegions] = useState<Item[]>([]);
  const [cities, setCities] = useState<Item[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!setup.connected) return;
    btsDirectoryAction().then((r) => r.ok && setRegions(r.data));
  }, [setup.connected]);
  useEffect(() => {
    if (!setup.connected || !form.senderRegionCode) return setCities([]);
    btsDirectoryAction(form.senderRegionCode).then((r) => r.ok && setCities(r.data));
  }, [setup.connected, form.senderRegionCode]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Qanday ulanadi</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>BTS bilan shartnoma tuzing va ulardan <b>API login, parol</b> hamda <b>ishchi server manzilini</b> so&apos;rang.</li>
          <li>Ularni pastga o&apos;zingiz kiriting — parol shifrlanib saqlanadi.</li>
          <li>Jo&apos;natuvchi (do&apos;kon) ma&apos;lumotlarini to&apos;ldiring.</li>
        </ol>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setMsg(null);
            const r = await connectBtsAction({ baseUrl, login, password });
            if (r.ok) {
              setLogin("");
              setPassword("");
              setMsg({ ok: true, text: "BTS'ga kirish muvaffaqiyatli ✓ Endi jo'natuvchi ma'lumotlarini to'ldiring." });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          });
        }}
        className="space-y-4 rounded-2xl border border-line bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">1. Kirish ma&apos;lumotlari</h2>
          {setup.connected && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${setup.complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {setup.complete ? "Ulangan" : "Jo'natuvchi to'ldirilmagan"}
            </span>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Server manzili</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={`${input} font-mono`} />
          <span className="mt-1 block text-xs text-muted">Sinov uchun https://apitest.bts.uz:28345 — ishchi manzilni BTS beradi.</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Login</span>
            <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="off" placeholder={setup.keyHint ? `Saqlangan (${setup.keyHint})` : ""} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Parol</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={setup.connected ? "Saqlangan — o'zgartirish uchun kiriting" : ""}
              className={input}
            />
          </label>
        </div>
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? "Tekshirilmoqda…" : "Saqlash va tekshirish"}
        </button>
      </form>

      {setup.connected && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setMsg(null);
              const r = await saveBtsSettingsAction({ ...form, defaultWeight: Number(form.defaultWeight) || 1 });
              if (r.ok) {
                setMsg({ ok: true, text: "Saqlandi ✓ Endi buyurtmalarda «📦 BTS» bo'limi chiqadi." });
                router.refresh();
              } else setMsg({ ok: false, text: r.error });
            });
          }}
          className="space-y-4 rounded-2xl border border-line bg-white p-5"
        >
          <h2 className="font-semibold">2. Jo&apos;natuvchi (do&apos;kon)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Nomi / ism</span>
              <input value={form.senderName} onChange={set("senderName")} className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Telefon</span>
              <input value={form.senderPhone} onChange={set("senderPhone")} inputMode="tel" className={input} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Viloyat</span>
              <select value={form.senderRegionCode} onChange={(e) => setForm((f) => ({ ...f, senderRegionCode: e.target.value, senderCityCode: "" }))} className={input}>
                <option value="">— tanlang —</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Shahar / tuman</span>
              <select value={form.senderCityCode} onChange={set("senderCityCode")} className={input}>
                <option value="">{form.senderCityCode && !cities.length ? `Kod: ${form.senderCityCode}` : "— tanlang —"}</option>
                {cities.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Manzil</span>
            <input value={form.senderAddress} onChange={set("senderAddress")} placeholder="Toshkent sh., Bobur ko'chasi, 5-A" className={input} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Jo&apos;natmani topshirish</span>
              <select value={form.pickupType} onChange={set("pickupType")} className={input}>
                <option value="courier">BTS kuryeri olib ketadi</option>
                <option value="self">O&apos;zim filialga olib boraman</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Standart og&apos;irlik (kg)</span>
              <input value={form.defaultWeight} onChange={set("defaultWeight")} inputMode="decimal" className={input} />
            </label>
          </div>
          <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {pending ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </form>
      )}

      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      {setup.connected && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("BTS uzilsinmi?")) return;
            start(async () => {
              await disconnectBtsAction();
              router.refresh();
            });
          }}
          className="text-sm text-red-600 underline"
        >
          BTS&apos;ni uzish
        </button>
      )}
    </div>
  );
}
