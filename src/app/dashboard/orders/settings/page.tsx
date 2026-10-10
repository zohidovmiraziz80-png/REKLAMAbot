import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { getShopSettings } from "@/actions/shop";
import { SettingsForm } from "./settings-form";
import { getCourierSetup } from "@/actions/couriers";
import { Couriers } from "./couriers";

export const metadata: Metadata = { title: "Do'kon sozlamalari" };

export default async function ShopSettingsPage() {
  const [result, courierSetup] = await Promise.all([runAction(getShopSettings, {}), runAction(getCourierSetup, {})]);
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  const { settings, bots } = result.data;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted">
        <Link href="/dashboard/orders" className="hover:text-ink">
          Buyurtmalar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">Do&apos;kon sozlamalari</span>
      </div>

      <SettingsForm initial={settings} />

      {courierSetup.ok && <Couriers setup={courierSetup.data} />}

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Buyurtmalar Telegram guruhga tushsin</h2>
        {settings.group_chat_id ? (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✅ Ulangan guruh: <b>{settings.group_title ?? "Guruh"}</b>. Yangi buyurtmalar shu yerga keladi, xodimlar tugmalar bilan holatini o&apos;zgartiradi.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Hozir buyurtmalar faqat bot egasining shaxsiy chatiga keladi. Xodimlar bilan ishlash uchun guruh ulang.</p>
        )}
        {bots.length === 0 ? (
          <p className="mt-3 text-sm">
            Avval{" "}
            <Link href="/dashboard/bots" className="font-medium text-brand-600 hover:underline">
              Telegram bot ulang
            </Link>
            .
          </p>
        ) : (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li>Telegram&apos;da guruh oching (yoki mavjudini tanlang).</li>
            <li>
              Botingizni guruhga qo&apos;shing: <b>@{bots[0].username}</b>
            </li>
            <li>
              Guruhga shu xabarni yuboring:
              <code className="mt-1 block rounded-lg bg-surface px-3 py-2 font-mono text-sm select-all">
                /ulash@{bots[0].username} {settings.group_link_code}
              </code>
            </li>
          </ol>
        )}
      </section>
    </div>
  );
}
