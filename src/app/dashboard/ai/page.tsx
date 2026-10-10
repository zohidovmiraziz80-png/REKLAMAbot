import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { getAiSettings } from "@/actions/ai-assistant";
import { AiForm } from "./ai-form";

export const metadata: Metadata = { title: "AI yordamchi" };
export const dynamic = "force-dynamic";

export default async function AiPage() {
  const r = await runAction(getAiSettings, {});
  if (!r.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{r.error}</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">🤖 AI yordamchi</h1>
      <p className="mt-1 mb-6 text-muted">
        Mijoz savollariga mahsulotlaringiz va do&apos;kon sozlamalari asosida darhol javob beradi: &quot;bu bormi?&quot;, &quot;narxi qancha?&quot;, &quot;yetkazib berasizmi?&quot;.
      </p>
      {!r.data.hasBot ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Avval <Link href="/dashboard/bots" className="font-semibold underline">Telegram botni ulang</Link> — AI sozlamalari bot bilan saqlanadi.
        </p>
      ) : (
        <AiForm initial={r.data} />
      )}
    </div>
  );
}
