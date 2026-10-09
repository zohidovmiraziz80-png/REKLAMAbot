import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { runAction } from "@/actions/run";
import { getWebsite } from "@/actions/websites";
import { getPublishStatus } from "@/actions/publishing";
import { isAiEnabled } from "@/lib/ai/config";
import { GenerateForm } from "./generate-form";
import { SiteEditor } from "./editor";
import { TemplatePicker } from "./template-picker";

// AI yoqilganda javob 1 daqiqagacha cho'zilishi mumkin
export const maxDuration = 120;

export const metadata: Metadata = { title: "Sayt tahrirlovchisi" };

export default async function SiteEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const result = await runAction(getWebsite, { projectId: id });
  if (!result.ok) {
    if (result.code === "not_found" || result.code === "validation") notFound();
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  }

  const website = result.data;
  const aiEnabled = isAiEnabled();
  const publish = website.content ? await runAction(getPublishStatus, { projectId: id }) : null;

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <Link href="/dashboard/sites" className="hover:text-ink">
          Saytlar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">{website.projectName}</span>
      </div>

      {website.content && publish && !publish.ok ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{publish.error}</p>
      ) : website.content && publish?.ok ? (
        <SiteEditor
          publishStatus={publish.data}
          projectId={website.projectId}
          initialSite={website.content}
          initialVersion={website.version}
          aiEnabled={aiEnabled}
        />
      ) : aiEnabled && mode === "ai" ? (
        <GenerateForm projectId={website.projectId} defaultName={website.projectName} />
      ) : (
        <TemplatePicker projectId={website.projectId} defaultName={website.projectName} aiEnabled={aiEnabled} />
      )}
    </div>
  );
}
