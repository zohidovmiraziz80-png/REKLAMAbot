"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CardPaySetup } from "@/actions/card-pay";
import { formatDateTime, formatMoney } from "@/lib/shop/format";
import { saveCardAction, unlinkChannelAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function CardForm({ setup }: { setup: CardPaySetup }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(setup.enabled);
  const [cardNumber, setCardNumber] = useState(setup.cardNumber);
  const [cardHolder, setCardHolder] = useState(setup.cardHolder);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const command = `/tolov ${setup.channelCode}`;

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setMsg(null);
            const r = await saveCardAction({ enabled, cardNumber, cardHolder });
            if (r.ok) {
              setCardNumber(r.data.cardNumber);
              setMsg({ ok: true, text: enabled ? "Saqlandi. Saytda «Kartaga o'tkazma» usuli chiqadi." : "Saqlandi. To'lov usuli o'chirildi." });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          });
        }}
        className="space-y-4 rounded-2xl border border-line bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">1. Karta</h2>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Saytda yoqish
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Karta raqami (Uzcard / Humo)</span>
          <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="8600 0000 0000 0000" className={`${input} font-mono`} />
          <span className="mt-1 block text-xs text-muted">Bu raqam buyurtmadan keyin mijozga ko&apos;rsatiladi. Bildirishnomasi kanalga tushadigan karta bo&apos;lsin.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Karta egasi (ixtiyoriy)</span>
          <input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} autoComplete="off" placeholder="ALIYEV A." className={input} />
        </label>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </form>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">2. To&apos;lov xabarlari kanali</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${setup.channelLinked ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {setup.channelLinked ? `Ulangan: ${setup.channelTitle ?? "kanal"}` : "Ulanmagan"}
          </span>
        </div>
        {!setup.botUsername ? (
          <p className="mt-2 text-sm text-red-600">Avval Telegram botni ulang (Kanallar → Telegram bot).</p>
        ) : (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li>Bank SMS / bildirishnomalari tushadigan Telegram kanalni oching (yoki yangi yopiq kanal yarating).</li>
            <li>
              Kanal → Administratorlar → <b>@{setup.botUsername}</b> ni qo&apos;shing (xabar yozish ruxsati bilan).
            </li>
            <li>
              Kanalga shu buyruqni yozing:
              <div className="mt-1 flex gap-2">
                <code className="block flex-1 rounded-lg bg-surface px-3 py-2 font-mono select-all">{command}</code>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard?.writeText(command).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    })
                  }
                  className="rounded-lg border border-line px-3 py-2 font-medium hover:bg-surface"
                >
                  {copied ? "✓" : "Nusxalash"}
                </button>
              </div>
            </li>
            <li>Bot «✅ Kanal ulandi» deb javob beradi. Shundan keyin kanalga tushgan har bir kirim xabari tekshiriladi.</li>
          </ol>
        )}
        <div className="mt-4 rounded-lg bg-surface p-3 text-xs text-muted">
          <b className="text-ink">SMS kanalga qanday tushadi?</b> Telefoningizga Android uchun «SMS Forwarder» turidagi ilovani o&apos;rnatib, bankdan kelgan SMS&apos;larni shu kanalga
          yuboradigan qilib sozlang. Bot summani «Пополнение 150 000 UZS», «popolnenie 150000.00 UZS», «+150 000 so&apos;m» kabi xabarlardan o&apos;qiydi, balans qatorini e&apos;tiborga
          olmaydi.
        </div>
        {setup.channelLinked && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Kanal uzilsinmi?")) return;
              start(async () => {
                await unlinkChannelAction();
                router.refresh();
              });
            }}
            className="mt-3 text-sm text-red-600 underline"
          >
            Kanalni uzish
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">3. Qanday ishlaydi</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Har bir buyurtmaga noyob summa beriladi (jami summadan 1–99 so&apos;m kam), masalan 150 000 o&apos;rniga 149 963 so&apos;m.</li>
          <li>Kanalga shu summa tushsa — buyurtma «To&apos;langan» bo&apos;ladi, sizga va mijozga Telegram&apos;da xabar boradi.</li>
          <li>Mijoz yaxlit summa o&apos;tkazsa, jami summa bo&apos;yicha qidiriladi; mos buyurtma topilmasa sizga xabar keladi.</li>
          <li>Buyurtma xabaridagi «💳 To&apos;landi deb belgilash» tugmasi bilan qo&apos;lda ham tasdiqlash mumkin.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Oxirgi tushumlar</h2>
        {setup.recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Hali kanalga to&apos;lov xabari tushmagan.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {setup.recent.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{formatMoney(t.amount)}</p>
                  <p className="truncate text-xs text-muted">{t.text}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.matched ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {t.matched ? `№${t.orderNumber ?? "?"}` : "Mos topilmadi"}
                  </span>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(t.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
