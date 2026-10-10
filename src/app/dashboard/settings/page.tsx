import type { Metadata } from "next";
import { runAction } from "@/actions/run";
import { getSettings } from "@/actions/settings";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Sozlamalar" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const result = await runAction(getSettings, {});
  if (!result.ok) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sozlamalar</h1>
      <p className="mt-1 mb-6 text-muted">Do&apos;kon nomi, profilingiz, parol va xodimlar.</p>
      <SettingsView data={result.data} />
    </div>
  );
}
