"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { NoorSetup } from "@/actions/delivery-extra";
import { connectNoorAction, disconnectNoorAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function NoorForm({ setup }: { setup: NoorSetup }) {
  const router = useRouter();
  const s = setup.settings ?? {};
  const [form, setForm] = useState({
    pickupAddress: s.pickupAddress ?? "",
    coords: s.pickupLat != null && s.pickupLon != null ? `${s.pickupLat}, ${s.pickupLon}` : "",
    pickupComment: s.pickupComment ?? "",
    contactName: s.contactName ?? "",
    contactPhone: s.contactPhone ?? "+998 ",
    env: s.env ?? "prod",
    paymentType: s.paymentType ?? "BALANCE",
    doorToDoor: s.doorToDoor ? "1" : "",
  });
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function locate() {
    if (!navigator.geolocation) return setMsg({ ok: false, text: "Brauzer joylashuvni aniqlay olmaydi" });
    navigator.geolocation.getCurrentPosition(
      (p) => setForm((f) => ({ ...f, coords: `${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}` })),
      () => setMsg({ ok: false, text: "Joylashuvga ruxsat berilmadi. Koordinatani Yandex xaritadan nusxalab qo'ying." }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Qanday ulanadi</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Noor bilan shartnoma tuzing va shaxsiy menejeringizdan <b>API token (X-Auth)</b> so&apos;rang.</li>
          <li>Tokenni pastdagi maydonga o&apos;zingiz qo&apos;ying — u shifrlanib saqlanadi.</li>
          <li>Do&apos;kon manzili va koordinatasini kiriting, Saqlash ni bosing. Token avtomatik tekshiriladi.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">Sinab ko&apos;rish uchun «Server: Sinov» ni tanlang — u yerda buyurtmalar haqiqiy kuryerga bormaydi.</p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const [lat, lon] = form.coords.split(",").map((x) => Number(x.trim()));
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return setMsg({ ok: false, text: "Koordinatani «41.311081, 69.240562» ko'rinishida kiriting" });
          start(async () => {
            setMsg(null);
            const r = await connectNoorAction(
              {
                env: form.env,
                pickupAddress: form.pickupAddress,
                pickupLat: lat,
                pickupLon: lon,
                pickupComment: form.pickupComment,
                contactName: form.contactName,
                contactPhone: form.contactPhone,
                paymentType: form.paymentType,
                doorToDoor: !!form.doorToDoor,
              },
              token,
            );
            if (r.ok) {
              setToken("");
              setMsg({ ok: true, text: "Ulandi va tekshirildi ✓ Endi buyurtmalarda «🛵 Noor» bo'limi chiqadi." });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          });
        }}
        className="space-y-4 rounded-2xl border border-line bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Sozlamalar</h2>
          {setup.connected && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${setup.complete ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {setup.complete ? "Ulangan" : "Xato"}
            </span>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">API token (X-Auth)</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            placeholder={setup.keyHint ? `Saqlangan (${setup.keyHint}) — o'zgartirish uchun yangisini kiriting` : "Tokenni joylang"}
            className={`${input} font-mono`}
          />
          <span className="mt-1 block text-xs text-muted">Token shifrlanib saqlanadi va hech kimga ko&apos;rsatilmaydi.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Olib ketish manzili (do&apos;kon)</span>
          <input value={form.pickupAddress} onChange={set("pickupAddress")} placeholder="Toshkent, Amir Temur ko'chasi, 15" className={input} />
          <span className="mt-1 block text-xs text-muted">Shahar, ko&apos;cha va uy raqami — xonadon va qavatni izohga yozing.</span>
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium">Koordinata (kenglik, uzunlik)</span>
          <div className="flex gap-2">
            <input value={form.coords} onChange={set("coords")} placeholder="41.311081, 69.240562" className={`${input} font-mono`} />
            <button type="button" onClick={locate} className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface">
              📍 Hozirgi joy
            </button>
          </div>
          <span className="mt-1 block text-xs text-muted">Do&apos;konda turib «Hozirgi joy» ni bosing yoki xaritada nuqtani bosib koordinatani nusxalang.</span>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Kuryer uchun izoh (ixtiyoriy)</span>
          <input value={form.pickupComment} onChange={set("pickupComment")} placeholder="2-qavat, 5-xona; kirish hovli tomondan" className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Mas&apos;ul shaxs</span>
            <input value={form.contactName} onChange={set("contactName")} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Telefon</span>
            <input value={form.contactPhone} onChange={set("contactPhone")} inputMode="tel" className={input} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Yetkazish haqini to&apos;lash</span>
            <select value={form.paymentType} onChange={set("paymentType")} className={input}>
              <option value="BALANCE">Noor balansimdan</option>
              <option value="CARD">Noor&apos;ga ulangan kartamdan</option>
              <option value="CASH">Mijoz kuryerga naqd to&apos;laydi</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Server</span>
            <select value={form.env} onChange={set("env")} className={input}>
              <option value="prod">Ishchi (back.noor.uz)</option>
              <option value="test">Sinov (tback.noor.uz)</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.doorToDoor} onChange={(e) => setForm((f) => ({ ...f, doorToDoor: e.target.checked ? "1" : "" }))} />
          Eshikkacha yetkazish (kuryer qavatga ko&apos;tariladi)
        </label>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? "Tekshirilmoqda…" : "Saqlash va tekshirish"}
        </button>
      </form>

      {setup.connected && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Uzish</h2>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Noor uzilsinmi?")) return;
              start(async () => {
                await disconnectNoorAction();
                router.refresh();
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
