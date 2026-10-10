import type { Metadata } from "next";
import { runAction } from "@/actions/run";
import { broadcastInfo, channelInfo, listPromos } from "@/actions/marketing";
import { ChannelPost } from "./channel";
import { Broadcast } from "./broadcast";
import { Promos } from "./promos";

export const metadata: Metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";
// Ommaviy xabar partiyalari uchun
export const maxDuration = 60;

export default async function MarketingPage() {
  const [bots, promos, channel] = await Promise.all([runAction(broadcastInfo, {}), runAction(listPromos, {}), runAction(channelInfo, {})]);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Marketing</h1>
        <p className="mt-1 text-muted">Bot obunachilariga xabar yuboring va chegirma promo-kodlari yarating.</p>
      </div>
      {channel.ok && <ChannelPost info={channel.data} />}
      <Broadcast bots={bots.ok ? bots.data : []} />
      <Promos ready={promos.ok && promos.data.ready} promos={promos.ok ? promos.data.promos : []} />
    </div>
  );
}
