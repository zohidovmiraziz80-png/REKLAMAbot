import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { Sidebar } from "./sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const workspace = await getActiveWorkspace(supabase, user.id);
  const userName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Foydalanuvchi";

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar userName={userName} workspaceName={workspace?.name ?? "Workspace"} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">
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
