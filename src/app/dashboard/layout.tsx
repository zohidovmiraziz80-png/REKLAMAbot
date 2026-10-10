import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getActiveWorkspace } from "@/lib/workspace";
import { getWorkspacePlan } from "@/lib/plans";
import { Sidebar } from "./sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const workspace = await getActiveWorkspace(supabase, user.id);
  const [plan, { data: isAdmin }, { count: newOrders }] = await Promise.all([
    workspace ? getWorkspacePlan(supabase, workspace.id) : Promise.resolve(null),
    supabase.rpc("is_platform_admin"),
    workspace
      ? supabase.from("orders").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "new")
      : Promise.resolve({ count: 0 }),
  ]);
  const userName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Foydalanuvchi";

  return (
    <div className="min-h-dvh bg-[#f4f6fa] lg:flex">
      <Suspense>
        <Sidebar
          userName={userName}
          workspaceName={workspace?.name ?? "Do'kon"}
          planName={plan ? `${plan.planName}${plan.status === "trial" ? " · sinov" : ""}` : undefined}
          newOrders={newOrders ?? 0}
          isAdmin={isAdmin === true}
        />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">
        {plan && plan.status !== "active" && (
          <div
            className={`mx-auto mb-6 flex max-w-6xl flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm ${
              plan.status === "expired" ? "border border-red-200 bg-red-50 text-red-800" : "border border-accent-100 bg-accent-50 text-ink"
            }`}
          >
            <span>
              {plan.status === "trial"
                ? `Sinov muddati: yana ${plan.daysLeft} kun barcha imkoniyatlar ochiq.`
                : "Sinov muddati tugagan. Yangi sayt/bot yaratish va nashr qilish uchun tarifni faollashtiring."}
            </span>
            <Link href="/dashboard/plan" className="font-semibold text-brand-700 hover:underline">
              Tariflarni ko&apos;rish →
            </Link>
          </div>
        )}
        {workspace ? (
          children
        ) : (
          <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <h1 className="font-semibold">Workspace topilmadi</h1>
            <p className="mt-2 text-sm">
              Akkauntingiz uchun workspace yaratilmagan. Supabase&apos;da migration to&apos;liq bajarilganini tekshiring
              (README, 2-qadam).
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
