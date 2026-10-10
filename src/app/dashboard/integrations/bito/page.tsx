import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { getBitoSetup } from "@/actions/integrations";
import { BitoConnect, BitoSettingsPanel } from "./bito-setup";

export const metadata: Metadata = { title: "Bito integratsiyasi" };
// Katta katalogni sinxronlash bir necha daqiqa davom etishi mumkin
export const maxDuration = 300;

export default async function BitoPage() {
  const result = await runAction(getBitoSetup, {});
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  const setup = result.data;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted">
        <Link href="/dashboard/integrations" className="hover:text-ink">
          Integratsiyalar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">Bito</span>
      </div>
      <div className="mb-6 flex items-center gap-3">
        <span className="text-4xl">📊</span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bito</h1>
          <p className="text-muted">Mahsulot, narx va qoldiq Bito&apos;dan olinadi; saytdagi buyurtmalar Bito&apos;ga sotuv buyurtmasi bo&apos;lib tushadi.</p>
        </div>
      </div>
      {setup.connected && setup.settings ? <BitoSettingsPanel setup={setup} /> : <BitoConnect />}
    </div>
  );
}
