import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { getEskizSetup } from "@/actions/sms";
import { EskizForm } from "./eskiz-form";

export const metadata: Metadata = { title: "Eskiz SMS" };
export const dynamic = "force-dynamic";

export default async function EskizPage() {
  const r = await runAction(getEskizSetup, {});
  if (!r.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{r.error}</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted">
        <Link href="/dashboard/integrations" className="hover:text-ink">
          Integratsiyalar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">Eskiz SMS</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">✉️ Eskiz SMS</h1>
      <p className="mt-1 mb-6 text-muted">Telegram&apos;i yo&apos;q mijozlarga buyurtma qabul qilingani va holati SMS bilan boradi.</p>
      <EskizForm setup={r.data} />
    </div>
  );
}
