import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { runAction } from "@/actions/run";
import { getWebsite } from "@/actions/websites";
import { GenerateForm } from "./generate-form";
import { SiteEditor } from "./editor";

// AI javobi 1 daqiqagacha cho'zilishi mumkin
export const maxDuration = 120;

export const metadata: Metadata = { title: "Sayt tahrirlovchisi" };

export default async function SiteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const result = await runAction(getWebsite, { projectId: id });
  if (!result.ok) {
    if (result.code === "not_found" || result.code === "validation") notFound();
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  }

  const website = result.data;

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <Link href="/dashboard/sites" className="hover:text-ink">
          Saytlar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">{website.projectName}</span>
      </div>

      {website.content ? (
        <SiteEditor projectId={website.projectId} initialSite={website.content} initialVersion={website.version} />
      ) : (
        <GenerateForm projectId={website.projectId} defaultName={website.projectName} />
      )}
    </div>
  );
}
