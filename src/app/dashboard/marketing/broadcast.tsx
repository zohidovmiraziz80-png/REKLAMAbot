"use client";

import { useState } from "react";
import type { BroadcastBot } from "@/actions/marketing";
import { broadcastChunkAction, broadcastTestAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function Broadcast({ bots }: { bots: BroadcastBot[] }) {
  const [bot, setBot] = useState(bots[0]?.projectId ?? "");
  const [text, setText] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number; done: boolean } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const current = bots.find((b) => b.projectId === bot);
  const data = { botProjectId: bot, text, buttonText, buttonUrl };

  if (!bots.length) {
    return (
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">📣 Ommaviy xabar</h2>
        <p className="mt-2 text-sm text-muted">Avval Telegram botni ulang — xabar bot obunachilariga yuboriladi.</p>
      </section>
    );
  }

  async function sendAll() {
    if (!current) return;
    if (!window.confirm(`${current.subscribers} ta obunachiga xabar yuborilsinmi? Buni qaytarib bo'lmaydi.`)) return;
    setBusy(true);
    setMsg(null);
    let offset: number | null = 0;
    let sent = 0;
    let failed = 0;
    let total = current.subscribers;
    while (offset !== null) {
      const r = await broadcastChunkAction({ ...data, offset });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        break;
      }
      sent += r.data.sent;
      failed += r.data.failed;
      total = r.data.total;
      offset = r.data.nextOffset;
      setProgress({ sent, failed, total, done: offset === null });
    }
    setBusy(false);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-semibold">📣 Ommaviy xabar</h2>
        <p className="mt-0.5 text-sm text-muted">Botingizga /start bosgan hamma mijozga boradi. Reklamani me&apos;yorida yuboring — ko&apos;p xabardan mijozlar botni bloklaydi.</p>
      </div>
      {bots.length > 1 && (
        <select value={bot} onChange={(e) => setBot(e.target.value)} className={input}>
          {bots.map((b) => (
            <option key={b.projectId} value={b.projectId}>
              @{b.username} — {b.subscribers} obunachi
            </option>
          ))}
        </select>
      )}
      <p className="text-sm">
        Qabul qiluvchilar: <b>{current?.subscribers ?? 0}</b> obunachi (@{current?.username})
      </p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Xabar</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={3500}
          placeholder={"Salom, {ism}! 🎁 Bugun barcha mahsulotlarga 10% chegirma. Promo-kod: YANGI10"}
          className={input}
        />
        <span className="mt-1 block text-xs text-muted">{"{ism}"} — mijoz ismi bilan almashtiriladi.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Tugma matni (ixtiyoriy), masalan: 🛍 Do'konni ochish" className={input} />
        <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="Tugma havolasi: https://..." className={input} />
      </div>
      {progress && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.min(100, ((progress.sent + progress.failed) / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
          <p className="mt-1 text-sm">
            {progress.done ? "✅ Tugadi: " : "Yuborilmoqda… "}
            {progress.sent} ta yetkazildi{progress.failed ? `, ${progress.failed} ta yetmadi (botni bloklagan)` : ""}
          </p>
        </div>
      )}
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={async () => {
            setMsg(null);
            const r = await broadcastTestAction(data);
            setMsg(r.ok ? { ok: true, text: "Sinov xabari sizga Telegram'da yuborildi ✓" } : { ok: false, text: r.error });
          }}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          Avval o&apos;zimga sinab ko&apos;rish
        </button>
        <button
          type="button"
          disabled={busy || !text.trim() || !current?.subscribers}
          onClick={sendAll}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Yuborilmoqda…" : "Hammaga yuborish"}
        </button>
      </div>
    </section>
  );
}
