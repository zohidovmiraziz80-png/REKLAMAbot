"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { FargoSetup } from "@/actions/delivery-extra";
import { connectFargoAction, disconnectFargoAction, fargoDirectoryAction, saveFargoSettingsAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function FargoForm({ setup }: { setup: FargoSetup }) {
  const router = useRouter();
  const s = setup.settings ?? {};
  const [baseUrl, setBaseUrl] = useState(s.baseUrl ?? "https://fargo.tezbor.com");
  const [authMode, setAuthMode] = useState<"password" | "token">("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [form, setForm] = useState({
    senderName: s.senderName ?? "",
    senderPhone: s.senderPhone ?? "+998",
    senderAddress: s.senderAddress ?? "",
    senderCity: s.senderCity ?? "",
    senderDistrict: s.senderDistrict ?? "",
    coords: s.senderLat != null && s.senderLon != null ? `${s.senderLat}, ${s.senderLon}` : "",
    pickupFromDoor: s.pickupFromDoor === false ? "branch" : "door",
    deliveryOption: String(s.deliveryOption ?? 1),
    defaultWeight: String(s.defaultWeight ?? 1),
  });
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!setup.connected) return;
    fargoDirectoryAction().then((r) => r.ok && setCities(r.data));
  }, [setup.connected]);
  useEffect(() => {
    if (!setup.connected || !form.senderCity) return setDistricts([]);
    fargoDirectoryAction(form.senderCity).then((r) => r.ok && setDistricts(r.data));
  }, [setup.connected, form.senderCity]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Qanday ulanadi</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            <b>dashboard.tezbor.uz</b> kabinetiga kiradigan <b>telefon raqam va parol</b> kerak. Parol bo&apos;lmasa: kabinet → Profil → «Сменить пароль».
          </li>
          <li>Ularni pastga o&apos;zingiz kiriting — parol va token shifrlanib saqlanadi.</li>
          <li>Jo&apos;natuvchi (do&apos;kon) ma&apos;lumotlarini to&apos;ldiring.</li>
        </ol>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setMsg(null);
            const r = await connectFargoAction({
              baseUrl,
              phone: authMode === "password" ? phone : "",
              password: authMode === "password" ? password : "",
              token: authMode === "token" ? token : "",
            });
            if (r.ok) {
              setPhone("");
              setPassword("");
              setToken("");
              setMsg({ ok: true, text: "Fargo'ga kirish muvaffaqiyatli ✓ Endi jo'natuvchi ma'lumotlarini to'ldiring." });
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
          <span className="mb-1 block text-sm font-medium">API server manzili</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." className={`${input} font-mono`} />
          <span className="mt-1 block text-xs text-muted">Fargo uchun: https://fargo.tezbor.com (o&apos;zgartirmang).</span>
        </label>
        <div className="flex gap-2 text-sm">
          {(
            [
              ["password", "Telefon + parol"],
              ["token", "Tayyor token"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAuthMode(id)}
              className={`rounded-full px-3 py-1 ${authMode === id ? "bg-brand-600 font-semibold text-white" : "border border-line"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {authMode === "password" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Telefon (login)</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" inputMode="tel" placeholder={setup.keyHint ? `Saqlangan (${setup.keyHint})` : "+998"} className={input} />
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
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              placeholder={setup.connected ? "Saqlangan — o'zgartirish uchun kiriting" : ""}
              className={`${input} font-mono`}
            />
          </label>
        )}
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? "Tekshirilmoqda…" : "Saqlash va tekshirish"}
        </button>
      </form>

      {setup.connected && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const [lat, lon] = form.coords ? form.coords.split(",").map((x) => Number(x.trim())) : [NaN, NaN];
            const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);
            start(async () => {
              setMsg(null);
              const r = await saveFargoSettingsAction({
                senderName: form.senderName,
                senderPhone: form.senderPhone,
                senderAddress: form.senderAddress,
                senderCity: form.senderCity,
                senderDistrict: form.senderDistrict,
                senderLat: hasGeo ? lat : null,
                senderLon: hasGeo ? lon : null,
                pickupFromDoor: form.pickupFromDoor === "door",
                deliveryOption: Number(form.deliveryOption) === 2 ? 2 : 1,
                defaultWeight: Number(form.defaultWeight) || 1,
              });
              if (r.ok) {
                setMsg({ ok: true, text: "Saqlandi ✓ Endi buyurtmalarda «🚚 Fargo» bo'limi chiqadi." });
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
              <span className="mb-1 block text-sm font-medium">Shahar / viloyat</span>
              <select value={form.senderCity} onChange={(e) => setForm((f) => ({ ...f, senderCity: e.target.value, senderDistrict: "" }))} className={input}>
                <option value="">{form.senderCity && !cities.length ? form.senderCity : "— tanlang —"}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Tuman</span>
              <select value={form.senderDistrict} onChange={set("senderDistrict")} className={input}>
                <option value="">{form.senderDistrict && !districts.length ? form.senderDistrict : "— tanlang —"}</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Manzil</span>
            <input value={form.senderAddress} onChange={set("senderAddress")} placeholder="Uychi ko'chasi 5, 11-uy" className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Koordinata (ixtiyoriy)</span>
            <input value={form.coords} onChange={set("coords")} placeholder="41.311081, 69.240562" className={`${input} font-mono`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Topshirish</span>
              <select value={form.pickupFromDoor} onChange={set("pickupFromDoor")} className={input}>
                <option value="door">Fargo kuryeri olib ketadi</option>
                <option value="branch">O&apos;zim filialga topshiraman</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Tezlik</span>
              <select value={form.deliveryOption} onChange={set("deliveryOption")} className={input}>
                <option value="1">Standart</option>
                <option value="2">Ekspress</option>
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
            if (!window.confirm("Fargo uzilsinmi?")) return;
            start(async () => {
              await disconnectFargoAction();
              router.refresh();
            });
          }}
          className="text-sm text-red-600 underline"
        >
          Fargo&apos;ni uzish
        </button>
      )}
    </div>
  );
}
