"use client";

import { useState, useTransition } from "react";
import type { CourierSetup } from "@/actions/couriers";
import { saveOrderAdminsAction } from "../actions";

export function OrderAdmins({ setup }: { setup: CourierSetup }) {
  const [text, setText] = useState(setup.admins.join(", "));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!setup.hasBot) return null;
  return (
    <section className="mt-6 space-y-3 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-semibold">📥 Buyurtma qabul qiluvchilar (Telegram ID)</h2>
        <p className="mt-0.5 text-sm text-muted">Yangi buyurtma va to&apos;lov xabarlari shu odamlarga @{setup.botUsername} orqali keladi; ular tugmalar bilan holatni o&apos;zgartira oladi.</p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>
          Telegram&apos;da <b>@{setup.botUsername}</b> ni oching va <b>/start</b>, keyin <b>/id</b> deb yozing.
        </li>
        <li>Bot ko&apos;rsatgan raqamni (masalan 123456789) shu yerga qo&apos;shing. Bir nechta bo&apos;lsa — vergul bilan.</li>
      </ol>
      {!setup.ownerLinked && setup.admins.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">⚠️ Hozir buyurtma xabarlari hech kimga bormayapti — kamida bitta ID qo&apos;shing.</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="123456789, 987654321"
          inputMode="numeric"
          className="block w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const ids = text
              .split(/[\s,;]+/)
              .map((x) => x.trim())
              .filter(Boolean);
            if (ids.some((x) => !/^-?\d{5,16}$/.test(x))) return setMsg({ ok: false, text: "Faqat raqamli Telegram ID kiriting (masalan 123456789)" });
            start(async () => {
              const r = await saveOrderAdminsAction(ids.map(Number));
              setMsg(r.ok ? { ok: true, text: "Saqlandi ✓ Keyingi buyurtmalar shu ID'larga keladi." } : { ok: false, text: r.error });
            });
          }}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Saqlash
        </button>
      </div>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </section>
  );
}
