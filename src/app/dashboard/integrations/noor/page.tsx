import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { getNoorSetup } from "@/actions/delivery-extra";
import { NoorForm } from "./noor-form";

export const metadata: Metadata = { title: "Noor" };
export const dynamic = "force-dynamic";

export default async function NoorPage() {
  const result = await runAction(getNoorSetup, {});
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted">
        <Link href="/dashboard/integrations" className="hover:text-ink">
          Integratsiyalar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">Noor</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">🛵 Noor — shahar ichida yetkazish</h1>
      <p className="mt-1 mb-6 text-muted">Buyurtmaga bir tugma bilan kuryer chaqiring: narx oldindan ko&apos;rinadi, kuzatish havolasi mijozga Telegram&apos;da boradi.</p>
      <NoorForm setup={result.data} />
    </div>
  );
}
