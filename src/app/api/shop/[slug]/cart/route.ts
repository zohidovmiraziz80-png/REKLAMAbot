import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { identifyTelegramCustomer, storeCart } from "@/lib/shop/identify";
import { siteBySlug } from "@/lib/shop/site-lookup";
import { createAdminClient } from "@/lib/supabase/admin";

/** Telegram orqali tanilgan mijozning savati (tashlab ketilgan savat eslatmasi uchun) */
export const dynamic = "force-dynamic";

const body = z.object({
  items: z.array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(99) })).max(50),
  initData: z.string().max(4096).default(""),
  tgLink: z.object({ bot: z.string().max(64), chat: z.string().max(64) }).nullable().default(null),
  session: z.string().max(1200).default(""),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const db = createAdminClient();
  const site = await siteBySlug(db, slug);
  if (!site) return NextResponse.json({ ok: false }, { status: 404 });
  const who = await identifyTelegramCustomer(db, site.workspaceId, parsed.data);
  if (!who) return NextResponse.json({ ok: true, stored: false });
  await storeCart(db, who.botProjectId, who.chatId, { items: parsed.data.items, slug });
  return NextResponse.json({ ok: true, stored: true });
}
