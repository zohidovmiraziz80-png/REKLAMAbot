import type { Metadata } from "next";
import { runAction } from "@/actions/run";
import { getMyPlan } from "@/actions/plans";
import { PLAN_DEFS, formatPrice } from "@/lib/plans";

export const metadata: Metadata = { title: "Tarif" };

const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
function formatDate(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  return `${d.getUTCDate()}-${UZ_MONTHS[d.getUTCMonth()]}`;
}

export default async function PlanPage() {
  const result = await runAction(getMyPlan, {});
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  const { current, plans } = result.data;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tarif</h1>
      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        {current.status === "trial" && (
          <p>
            <span className="font-semibold">Sinov muddati:</span> barcha imkoniyatlar ochiq. Yana{" "}
            <span className="font-semibold text-accent-600">{current.daysLeft} kun</span>
            {current.trialEndsAt && <> ({formatDate(current.trialEndsAt)}gacha)</>}.
          </p>
        )}
        {current.status === "active" && (
          <p>
            <span className="font-semibold">Joriy tarif:</span> {current.planName}
          </p>
        )}
        {current.status === "expired" && (
          <p className="text-red-700">
            <span className="font-semibold">Sinov muddati tugagan.</span> Saytlar va botlar ishlashda davom etadi, lekin yangilarini yaratish va
            nashr qilish uchun tarifni faollashtiring.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = current.status === "active" && current.planId === plan.id;
          const highlight = plan.id === "site_bot";
          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border bg-white p-5 ${highlight ? "border-accent-500 ring-4 ring-accent-100" : "border-line"}`}
            >
              {highlight && (
                <span className="mb-3 w-fit rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-600">Eng qulay</span>
              )}
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-1 text-sm text-muted">{plan.description}</p>
              <p className="mt-4 text-lg font-bold text-brand-700">{formatPrice(plan.price_uzs)}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {PLAN_DEFS[plan.id].features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {isCurrent ? (
                  <span className="block rounded-lg bg-emerald-50 py-2.5 text-center text-sm font-semibold text-emerald-700">Joriy tarif</span>
                ) : (
                  <span className="block rounded-lg border border-line py-2.5 text-center text-sm font-medium text-muted">Onlayn to&apos;lov tez orada</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted">Tarifni faollashtirish yoki o&apos;zgartirish uchun administrator bilan bog&apos;laning.</p>
    </div>
  );
}
