import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { runAction } from "@/actions/run";
import { getBot } from "@/actions/bots";
import { BotDashboard } from "./bot-dashboard";
import { ConnectForm } from "./connect-form";

export const metadata: Metadata = { title: "Telegram bot" };

export default async function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const result = await runAction(getBot, { projectId: id });
  if (!result.ok) {
    if (result.code === "not_found" || result.code === "validation") notFound();
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>;
  }
  const bot = result.data;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <Link href="/dashboard/bots" className="hover:text-ink">
          Botlar
        </Link>
        <span>/</span>
        <span className="font-medium text-ink">{bot.projectName}</span>
      </div>

      {bot.connected ? <BotDashboard initial={bot} /> : <ConnectForm projectId={bot.projectId} encryptionReady={bot.encryptionReady} />}
    </div>
  );
}
