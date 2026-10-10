"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { EskizSetup } from "@/actions/sms";
import { connectEskizAction, disconnectEskizAction, testSmsAction } from "./actions";

const DEFAULT_TPL_NEW = "{dokon}: buyurtmangiz №{nomer} qabul qilindi. Summa: {summa} so'm.";
const DEFAULT_TPL_STATUS = "{dokon}: buyurtma №{nomer} holati: {holat}.";
const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function EskizForm({ setup }: { setup: EskizSetup }) {
  const router = useRouter();
  const s = setup.settings ?? {};
  const [f, setF] = useState({
    email: s.email ?? "",
    from: s.from ?? "4546",
    shopName: s.shopName ?? "",
    onNew: s.onNew ?? true,
    onStatus: s.onStatus ?? true,
    onlyWithoutTelegram: s.onlyWithoutTelegram ?? true,
    tplNew: s.tplNew ?? DEFAULT_TPL_NEW,
    tplStatus: s.tplStatus ?? DEFAULT_TPL_STATUS,
  });
  const [password, setPassword] = useState("");
  const [testPhone, setTestPhone] = useState("+998");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const preview = (tpl: string) =>
    tpl.replace("{dokon}", f.shopName || "Do'kon").replace("{nomer}", "125").replace("{summa}", "150 000").replace("{holat}", "yo'lga chiqdi");

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Qanday ulanadi</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            <b>eskiz.uz</b> da ro&apos;yxatdan o&apos;ting va hisobni to&apos;ldiring.
          </li>
          <li>Kabinetdagi email va parolni pastga o&apos;zingiz kiriting — parol shifrlanib saqlanadi.</li>
          <li>
            Eskiz SMS matnlarini oldindan tekshiradi: pastdagi shablonlarni (namuna ko&apos;rinishida) Eskiz kabinetidagi <b>Shablonlar</b> bo&apos;limiga yuborib tasdiqlating.
          </li>
        </ol>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setMsg(null);
            const r = await connectEskizAction(f, password);
            if (r.ok) {
              setPassword("");
              setMsg({ ok: true, text: "Ulandi va tekshirildi ✓" });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          });
        }}
        className="space-y-4 rounded-2xl border border-line bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Sozlamalar</h2>
          {setup.connected && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${setup.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {setup.status === "active" ? "Ulangan" : "Xato"}
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Eskiz email</span>
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Eskiz paroli</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={setup.connected ? "Saqlangan — o'zgartirish uchun kiriting" : ""}
              className={input}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Jo&apos;natuvchi nomi</span>
            <input value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} maxLength={11} className={input} />
            <span className="mt-1 block text-xs text-muted">Standart 4546. O&apos;z nomingiz (masalan MIXPODAROK) Eskiz orqali alohida ro&apos;yxatdan o&apos;tkaziladi.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Do&apos;kon nomi (SMS&apos;da)</span>
            <input value={f.shopName} onChange={(e) => setF({ ...f, shopName: e.target.value })} maxLength={40} placeholder="MIX PODAROK" className={input} />
          </label>
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.onNew} onChange={(e) => setF({ ...f, onNew: e.target.checked })} /> Buyurtma qabul qilinganda SMS
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.onStatus} onChange={(e) => setF({ ...f, onStatus: e.target.checked })} /> Holat o&apos;zgarganda SMS (tasdiqlandi, yo&apos;lda, yakunlandi, bekor)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.onlyWithoutTelegram} onChange={(e) => setF({ ...f, onlyWithoutTelegram: e.target.checked })} /> Faqat Telegram&apos;dan xabar olmaydigan mijozlarga (tejash uchun)
          </label>
        </div>
        {[
          { k: "tplNew" as const, label: "Yangi buyurtma shabloni" },
          { k: "tplStatus" as const, label: "Holat shabloni" },
        ].map((t) => (
          <label key={t.k} className="block">
            <span className="mb-1 block text-sm font-medium">{t.label}</span>
            <textarea value={f[t.k]} onChange={(e) => setF({ ...f, [t.k]: e.target.value })} rows={2} maxLength={300} className={input} />
            <span className="mt-1 block text-xs text-muted">Namuna: {preview(f[t.k])}</span>
          </label>
        ))}
        <p className="text-xs text-muted">O&apos;zgaruvchilar: {"{dokon}"}, {"{nomer}"}, {"{summa}"}, {"{holat}"}.</p>
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? "Tekshirilmoqda…" : "Saqlash va tekshirish"}
        </button>
      </form>

      {setup.connected && (
        <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Sinov SMS</h2>
          <div className="flex gap-2">
            <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} inputMode="tel" className={input} />
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Sinov SMS yuborilsinmi? (1 ta SMS narxi yechiladi)")) return;
                start(async () => {
                  const r = await testSmsAction(testPhone);
                  setMsg(r.ok ? { ok: true, text: "SMS yuborildi ✓" } : { ok: false, text: r.error });
                });
              }}
              className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface"
            >
              Yuborish
            </button>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Eskiz uzilsinmi?")) return;
              start(async () => {
                await disconnectEskizAction();
                router.refresh();
              });
            }}
            className="text-sm text-red-600 underline"
          >
            Eskiz&apos;ni uzish
          </button>
        </section>
      )}
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
