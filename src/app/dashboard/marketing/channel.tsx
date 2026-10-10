"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ChannelInfo } from "@/actions/marketing";
import { postToChannelAction, setAutoPostAction, unlinkPostChannelAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function ChannelPost({ info }: { info: ChannelInfo }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [auto, setAuto] = useState(info.autoPostNew);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const command = `/kanal ${info.code}`;

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">📢 Telegram kanal</h2>
          <p className="mt-0.5 text-sm text-muted">Mahsulotlar va aksiyalar kanalingizga rasm, narx va «Buyurtma berish» tugmasi bilan chiqadi.</p>
        </div>
        {info.linked && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Ulangan: {info.title || "kanal"}</span>}
      </div>

      {!info.hasBot ? (
        <p className="text-sm text-muted">Avval Telegram botni ulang.</p>
      ) : !info.linked ? (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Kanalingiz → Administratorlar → <b>@{info.botUsername}</b> ni qo&apos;shing (xabar yozish ruxsati bilan).
          </li>
          <li>
            Kanalga shu buyruqni yozing: <code className="rounded bg-surface px-1.5 py-0.5 font-mono select-all">{command}</code>
          </li>
          <li>Bot «✅ Kanal ulandi» deb javob beradi — keyin shu sahifani yangilang.</li>
        </ol>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={auto}
              disabled={pending}
              onChange={(e) => {
                const v = e.target.checked;
                setAuto(v);
                start(async () => void (await setAutoPostAction(v)));
              }}
            />
            Yangi qo&apos;shilgan mahsulotni kanalga avtomatik chiqarish
          </label>
          <p className="text-xs text-muted">Istalgan mahsulotni Katalog → Mahsulotlar sahifasidagi «📣 Kanalga» tugmasi bilan ham chiqarasiz.</p>

          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm font-medium">Aksiya / e&apos;lon posti</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000} placeholder="🎉 Shu hafta barcha sovg'alarga 15% chegirma! Promo-kod: HAFTA15" className={input} />
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Rasm havolasi (ixtiyoriy): https://..." className={input} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Tugma matni (standart: 🛒 Do'konni ochish)" className={input} />
              <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="Tugma havolasi (standart: saytingiz)" className={input} />
            </div>
            {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={pending || !text.trim()}
                onClick={() =>
                  start(async () => {
                    setMsg(null);
                    const r = await postToChannelAction({ text, imageUrl, buttonText, buttonUrl });
                    if (r.ok) {
                      setText("");
                      setMsg({ ok: true, text: "Kanalga chiqdi ✓" });
                    } else setMsg({ ok: false, text: r.error });
                  })
                }
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Kanalga chiqarish
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Kanal uzilsinmi?")) return;
                  start(async () => {
                    await unlinkPostChannelAction();
                    router.refresh();
                  });
                }}
                className="text-sm text-red-600 underline"
              >
                Kanalni uzish
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
