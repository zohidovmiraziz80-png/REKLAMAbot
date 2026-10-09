import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NAV_ITEMS } from "../nav";
import { ProjectsView } from "../projects-view";

type Params = Promise<{ section: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { section } = await params;
  const item = NAV_ITEMS.find((i) => i.slug === section);
  return { title: item?.label ?? "Topilmadi" };
}

export default async function SectionPage({ params }: { params: Params }) {
  const { section } = await params;
  const item = NAV_ITEMS.find((i) => i.slug === section);
  if (!item) notFound();

  if (item.projectType) {
    return <ProjectsView title={item.label} subtitle={`${item.label} ro'yxati`} type={item.projectType} />;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{item.label}</h1>
      <div className="mt-8 rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
        <p className="inline-block rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">Tez kunda</p>
        <p className="mx-auto mt-3 max-w-md text-muted">{item.description}</p>
      </div>
    </div>
  );
}
