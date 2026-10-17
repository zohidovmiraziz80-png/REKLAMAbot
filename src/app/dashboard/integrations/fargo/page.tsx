import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { getFargoSetup } from "@/actions/delivery-extra";
import { FargoForm } from "./fargo-form";

export const metadata: Metadata = { title: "Fargo" };
export const dynamic = "force-dynamic";

export default async function FargoPage() {
  const result = await runAction(getFargoSetup, {});
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted">
        <Link href="/dashboard/integrations" className="hover:text-ink">
          Integratsiyalar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">Fargo</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">🚚 Fargo — viloyatlararo yetkazish</h1>
      <p className="mt-1 mb-6 text-muted">Viloyatlarga jo&apos;natish: narx oldindan hisoblanadi, trek raqami mijozga Telegram&apos;da boradi, holat buyurtmaga yoziladi.</p>
      <FargoForm setup={result.data} />
    </div>
  );
}
