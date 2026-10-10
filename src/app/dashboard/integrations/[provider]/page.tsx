import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { runAction } from "@/actions/run";
import { getPaySetup } from "@/actions/integrations";
import { PayForm } from "./pay-form";

export const metadata: Metadata = { title: "Onlayn to'lov" };

const TITLES = { payme: "Payme", click: "Click", multicard: "Multicard" } as const;

export default async function PayProviderPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "payme" && provider !== "click" && provider !== "multicard") notFound();
  const result = await runAction(getPaySetup, { provider });
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted">
        <Link href="/dashboard/integrations" className="hover:text-ink">
          Integratsiyalar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">{TITLES[provider]}</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{TITLES[provider]}</h1>
      <p className="mt-1 mb-6 text-muted">Mijozlar saytda va Telegram bot ichida karta bilan to&apos;laydi. To&apos;lov tushganda buyurtma o&apos;zi &quot;To&apos;langan&quot; bo&apos;ladi va sizga Telegram&apos;da xabar keladi.</p>
      <PayForm setup={result.data} />
    </div>
  );
}
