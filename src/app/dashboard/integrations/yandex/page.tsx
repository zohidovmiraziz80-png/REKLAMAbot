import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { getYandexSetup } from "@/actions/delivery";
import { YandexForm } from "./yandex-form";

export const metadata: Metadata = { title: "Yandex Delivery" };
export const dynamic = "force-dynamic";

export default async function YandexPage() {
  const result = await runAction(getYandexSetup, {});
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted">
        <Link href="/dashboard/integrations" className="hover:text-ink">
          Integratsiyalar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">Yandex Delivery</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">🚕 Yandex Delivery</h1>
      <p className="mt-1 mb-6 text-muted">
        Buyurtma xabaridagi tugma bilan kuryer chaqiring: narx oldindan ko&apos;rsatiladi, kuryer holati buyurtmaga o&apos;zi yoziladi, mijozga Telegram&apos;da xabar boradi.
      </p>
      <YandexForm setup={result.data} />
    </div>
  );
}
