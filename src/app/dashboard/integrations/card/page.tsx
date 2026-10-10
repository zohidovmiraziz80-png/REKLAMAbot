import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { getCardPaySetup } from "@/actions/card-pay";
import { CardForm } from "./card-form";

export const metadata: Metadata = { title: "Kartaga o'tkazma" };
export const dynamic = "force-dynamic";

export default async function CardPayPage() {
  const result = await runAction(getCardPaySetup, {});
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted">
        <Link href="/dashboard/integrations" className="hover:text-ink">
          Integratsiyalar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">Kartaga o&apos;tkazma</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Kartaga o&apos;tkazma</h1>
      <p className="mt-1 mb-6 text-muted">
        Mijoz buyurtmadan keyin kartangizga aniq summani o&apos;tkazadi. Bank xabari Telegram kanalga tushishi bilan bot summani tekshiradi va buyurtmani o&apos;zi
        &quot;To&apos;langan&quot; qiladi.
      </p>
      <CardForm setup={result.data} />
    </div>
  );
}
