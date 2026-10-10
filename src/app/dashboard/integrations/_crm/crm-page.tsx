import Link from "next/link";
import { runAction } from "@/actions/run";
import { getCrmSetup } from "@/actions/crm";
import { CrmForm } from "./crm-form";

export async function CrmPage({ provider }: { provider: "bitrix24" | "amocrm" }) {
  const r = await runAction(getCrmSetup, { provider });
  if (!r.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{r.error}</p>;
  const title = provider === "bitrix24" ? "Bitrix24" : "AmoCRM";
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted">
        <Link href="/dashboard/integrations" className="hover:text-ink">
          Integratsiyalar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">{title}</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">🗂 {title}</h1>
      <p className="mt-1 mb-6 text-muted">Har bir yangi buyurtma {title}&apos;ga mijoz kontakti, mahsulotlar ro&apos;yxati va summasi bilan avtomatik tushadi.</p>
      <CrmForm setup={r.data} />
    </div>
  );
}
