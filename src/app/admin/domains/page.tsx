import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDomainApiConfigured } from "@/lib/vercel/domains";
import { DomainAdminButtons } from "./domain-actions";
import { AdminHeader } from "../admin-header";

export const metadata: Metadata = { title: "Admin · Domenlar", robots: { index: false } };

type Row = {
  domain: string;
  status: "pending" | "active" | "error";
  last_error: string | null;
  created_at: string;
  project_id: string;
  projects: { name: string } | { name: string }[] | null;
};

export default async function AdminDomainsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/domains");

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin !== true) notFound();

  const { data } = await supabase
    .from("site_domains")
    .select("domain, status, last_error, created_at, project_id, projects ( name )")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as Row[];

  const { data: pubs } = rows.length
    ? await supabase.from("published_sites").select("project_id, slug").in("project_id", rows.map((r) => r.project_id))
    : { data: [] as { project_id: string; slug: string }[] };
  const slugByProject = new Map((pubs ?? []).map((p) => [p.project_id as string, p.slug as string]));

  const counts = {
    active: rows.filter((r) => r.status === "active").length,
    pending: rows.filter((r) => r.status === "pending").length,
    error: rows.filter((r) => r.status === "error").length,
  };

  return (
    <div className="min-h-dvh">
      <AdminHeader active="domains" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Domenlar</h1>
        <p className="mt-1 text-muted">Platformaga ulangan barcha o&apos;z domenlari va ularning holati.</p>

        {!isDomainApiConfigured() && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Vercel API sozlanmagan: <code>VERCEL_API_TOKEN</code> va <code>VERCEL_PROJECT_ID</code> qo&apos;shilmaguncha foydalanuvchilar
            o&apos;z domenini ulay olmaydi.
          </p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
          {[
            ["Faol", counts.active, "text-emerald-700"],
            ["Kutilmoqda", counts.pending, "text-accent-600"],
            ["Xato", counts.error, "text-red-600"],
          ].map(([label, n, cls]) => (
            <div key={label as string} className="rounded-xl border border-line bg-white p-3">
              <p className="text-xs text-muted">{label}</p>
              <p className={`text-2xl font-semibold ${cls}`}>{n}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Domen</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium">Sayt</th>
                <th className="px-4 py-3 font-medium">Izoh</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    Hali domen ulanmagan
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;
                const slug = slugByProject.get(r.project_id);
                return (
                  <tr key={r.domain} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium">{r.domain}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.status === "active" ? "bg-emerald-50 text-emerald-700" : r.status === "error" ? "bg-red-50 text-red-700" : "bg-accent-50 text-accent-600"
                        }`}
                      >
                        {r.status === "active" ? "Faol" : r.status === "error" ? "Xato" : "Kutilmoqda"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {project?.name ?? "—"}
                      {slug && (
                        <Link href={`/s/${slug}`} target="_blank" className="ml-2 text-xs text-brand-600 hover:underline">
                          /s/{slug}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{r.last_error ?? ""}</td>
                    <td className="px-4 py-3">
                      <DomainAdminButtons domain={r.domain} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
