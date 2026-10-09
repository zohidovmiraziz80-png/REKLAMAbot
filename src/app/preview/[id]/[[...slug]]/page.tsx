import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { runAction } from "@/actions/run";
import { getWebsite } from "@/actions/websites";
import { SiteRenderer } from "@/components/site/renderer";

type Params = Promise<{ id: string; slug?: string[] }>;

export const metadata: Metadata = { title: "Ko'rib chiqish", robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Params }) {
  const { id, slug } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const result = await runAction(getWebsite, { projectId: id });
  if (!result.ok || !result.data.content) notFound();

  const site = result.data.content;
  const pageSlug = slug?.[0] ?? "home";
  const page = site.pages.find((p) => p.slug === pageSlug);
  if (!page) notFound();

  return (
    <div className="min-h-dvh">
      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-2 text-xs text-white">
        <span>Ko&apos;rib chiqish rejimi — sayt hali nashr qilinmagan</span>
        <Link href={`/dashboard/sites/${id}`} className="rounded bg-white/15 px-2.5 py-1 font-semibold hover:bg-white/25">
          Tahrirlashga qaytish
        </Link>
      </div>
      <SiteRenderer site={site} page={page} basePath={`/preview/${id}`} />
    </div>
  );
}
