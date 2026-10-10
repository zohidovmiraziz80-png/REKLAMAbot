import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPlans } from "@/lib/plans";
import { AdminHeader } from "../admin-header";
import { PlanPriceForm, WorkspacePlanForm } from "./forms";

export const metadata: Metadata = { title: "Admin · Mijozlar", robots: { index: false } };

type Row = {
  id: string;
  name: string;
  owner_email: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  plan_id: "bot" | "site" | "site_bot" | "business";
  plan_status: "trial" | "active" | "expired";
  trial_ends_at: string | null;
  created_at: string;
  sites_count: number;
  bots_count: number;
};

export default async function AdminWorkspacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/workspaces");
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin !== true) notFound();

  const [{ data }, plans] = await Promise.all([supabase.rpc("admin_list_workspaces"), listPlans(supabase)]);
  const rows = (data ?? []) as Row[];
  const now = Date.now();
  const effective = (r: Row) =>
    r.plan_status === "trial" && (!r.trial_ends_at || new Date(r.trial_ends_at).getTime() < now) ? "expired" : r.plan_status;

  const counts = {
    total: rows.length,
    trial: rows.filter((r) => effective(r) === "trial").length,
    active: rows.filter((r) => effective(r) === "active").length,
    expired: rows.filter((r) => effective(r) === "expired").length,
  };

  return (
    <div className="min-h-dvh">
      <AdminHeader active="workspaces" />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mijozlar va tariflar</h1>
          <p className="mt-1 text-muted">Har bir mijozning tarifi, sinov muddati va loyihalari. Onlayn to&apos;lov ulanguncha tarifni shu yerdan faollashtirasiz.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Jami", counts.total, "text-ink"],
            ["Sinovda", counts.trial, "text-accent-600"],
            ["Faol", counts.active, "text-emerald-700"],
            ["Tugagan", counts.expired, "text-red-600"],
          ].map(([label, n, cls]) => (
            <div key={label as string} className="rounded-xl border border-line bg-white p-3">
              <p className="text-xs text-muted">{label}</p>
              <p className={`text-2xl font-semibold ${cls}`}>{n}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-3 font-semibold">Tarif narxlari</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <PlanPriceForm key={p.id} planId={p.id} name={p.name} price={p.price_uzs} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Mijozlar</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-muted">Hali mijoz yo&apos;q</p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((r) => {
                  const eff = effective(r);
                  return (
                    <li key={r.id} className="space-y-2 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{r.owner_name ?? r.name}</p>
                          <p className="text-sm text-muted">
                            {r.owner_email}
                            {r.owner_phone && <> · {r.owner_phone}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-surface px-2 py-0.5">{r.sites_count} sayt</span>
                          <span className="rounded-full bg-surface px-2 py-0.5">{r.bots_count} bot</span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${
                              eff === "active" ? "bg-emerald-50 text-emerald-700" : eff === "trial" ? "bg-accent-50 text-accent-600" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {eff === "active" ? "Faol" : eff === "trial" ? "Sinov" : "Tugagan"}
                          </span>
                        </div>
                      </div>
                      <WorkspacePlanForm
                        workspaceId={r.id}
                        planId={r.plan_id}
                        status={r.plan_status}
                        trialEndsAt={r.trial_ends_at}
                        plans={plans.map((p) => ({ id: p.id, name: p.name }))}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
