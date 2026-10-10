"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectBotAction } from "./actions";

const STEPS = [
  { title: "BotFather'ni oching", text: "Telegram'da @BotFather ni toping (ko'k belgili rasmiy bot) va Start bosing." },
  { title: "Yangi bot yarating", text: "/newbot buyrug'ini yuboring. Bot nomini (masalan: Gulzor Gullari) va oxiri bot bilan tugaydigan username'ni (masalan: gulzor_uz_bot) yozing." },
  { title: "Tokenni nusxalang", text: "BotFather 123456789:AAH... ko'rinishidagi tokenni beradi. Uni nusxalab, pastdagi maydonga joylang." },
];

export function ConnectForm({ projectId, encryptionReady }: { projectId: string; encryptionReady: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const r = await connectBotAction(projectId, token);
      if (r.ok) {
        setToken("");
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-line bg-white p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Telegram botni ulang</h1>
        <p className="mt-1 text-muted">Bot mijozlaringizga avtomatik javob beradi va buyurtmalarni qabul qiladi.</p>
      </div>

      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{i + 1}</span>
            <div>
              <p className="font-semibold">{s.title}</p>
              <p className="text-sm text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <a
        href="https://t.me/BotFather"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-brand-500"
      >
        ✈️ @BotFather&apos;ni ochish ↗
      </a>

      {!encryptionReady && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Server sozlamasi tugallanmagan (shifrlash kaliti). Administrator sozlagach, botni ulash mumkin bo&apos;ladi.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3 border-t border-line pt-6">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Bot tokeni</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="123456789:AAH..."
            className="block w-full rounded-lg border border-line px-3.5 py-2.5 font-mono text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
          <span className="mt-1 block text-xs text-muted">Token shifrlangan holda saqlanadi va hech kimga ko&apos;rsatilmaydi.</span>
        </label>
        <button
          type="submit"
          disabled={pending || !token.trim() || !encryptionReady}
          className="w-full rounded-lg bg-accent-500 px-4 py-3 text-[15px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {pending ? "Ulanmoqda..." : "Botni ulash"}
        </button>
      </form>
    </div>
  );
}
