import type { Metadata } from "next";
import Link from "next/link";
import { runAction } from "@/actions/run";
import { listIntegrations } from "@/actions/integrations";
import { getMyPlan } from "@/actions/plans";

export const metadata: Metadata = { title: "Integratsiyalar" };

type Card = { id: string; name: string; emoji: string; text: string; href?: string; group: string };

const CARDS: Card[] = [
  { id: "bito", name: "Bito", emoji: "📊", group: "Ombor va savdo", text: "Mahsulot, narx va qoldiq Bito'dan; buyurtmalar Bito'ga tushadi", href: "/dashboard/integrations/bito" },
  { id: "card", name: "Kartaga o'tkazma", emoji: "🏦", group: "To'lov", text: "Kartangizga o'tkazma, kanalga tushgan SMS orqali avto-tasdiq", href: "/dashboard/integrations/card" },
  { id: "payme", name: "Payme", emoji: "💳", group: "To'lov", text: "Saytda va bot ichida karta bilan to'lov", href: "/dashboard/integrations/payme" },
  { id: "click", name: "Click", emoji: "💳", group: "To'lov", text: "Click orqali onlayn to'lov", href: "/dashboard/integrations/click" },
  { id: "multicard", name: "Multicard", emoji: "💳", group: "To'lov", text: "Multicard orqali onlayn to'lov", href: "/dashboard/integrations/multicard" },
  { id: "yandex", name: "Yandex Delivery", emoji: "🚕", group: "Yetkazish", text: "Buyurtmaga kuryer chaqirish, narxni hisoblash", href: "/dashboard/integrations/yandex" },
  { id: "bts", name: "BTS", emoji: "📦", group: "Yetkazish", text: "Viloyatlarga jo'natish, trek raqami mijozga", href: "/dashboard/integrations/bts" },
  { id: "fargo", name: "Fargo", emoji: "🚚", group: "Yetkazish", text: "Kuryer va pochta xizmati — Fargo API berishini kutyapmiz" },
  { id: "eskiz", name: "Eskiz SMS", emoji: "✉️", group: "Xabarnoma", text: "Mijozga buyurtma holati SMS bilan" },
  { id: "amocrm", name: "AmoCRM", emoji: "🗂", group: "CRM", text: "Mijoz va buyurtmalar AmoCRM'ga" },
  { id: "bitrix24", name: "Bitrix24", emoji: "🗂", group: "CRM", text: "Mijoz va buyurtmalar Bitrix24'ga" },
];

export default async function IntegrationsPage() {
  const [result, planRes] = await Promise.all([runAction(listIntegrations, {}), runAction(getMyPlan, {})]);
  const plan = planRes.ok ? planRes.data.current : null;
  const connected = new Map((result.ok ? result.data : []).map((i) => [i.provider, i]));
  const groups = [...new Set(CARDS.map((c) => c.group))];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Integratsiyalar</h1>
      <p className="mt-1 text-muted">Xizmatlarni o&apos;z kalitingiz bilan ulang. Kalitlar shifrlanib saqlanadi va hech kimga ko&apos;rinmaydi.</p>
      {plan && !plan.integrations && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Bito, Payme, Click va Multicard <b>Biznes</b> tarifida ishlaydi. Joriy tarif: {plan.planName}.{" "}
          <Link href="/dashboard/plan" className="font-semibold underline">
            Tariflar
          </Link>
        </div>
      )}

      {groups.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.filter((c) => c.group === g).map((c) => {
              const st = connected.get(c.id);
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-3xl">{c.emoji}</span>
                    {st ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {st.status === "active" ? "Ulangan" : "Xato"}
                      </span>
                    ) : c.href ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Ulash</span>
                    ) : (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">tez kunda</span>
                    )}
                  </div>
                  <p className="mt-3 font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-muted">{c.text}</p>
                </>
              );
              return c.href ? (
                <Link key={c.id} href={c.href} className="rounded-2xl border border-line bg-white p-4 transition hover:border-brand-500 hover:shadow-sm">
                  {inner}
                </Link>
              ) : (
                <div key={c.id} className="rounded-2xl border border-line bg-white p-4 opacity-70">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
