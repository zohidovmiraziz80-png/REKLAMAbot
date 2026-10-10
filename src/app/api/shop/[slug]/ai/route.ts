import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { answerCustomer } from "@/lib/ai/assistant";
import { AIError } from "@/lib/ai/claude";
import { getWorkspacePlan } from "@/lib/plans";
import { siteBySlug } from "@/lib/shop/site-lookup";
import { createAdminClient } from "@/lib/supabase/admin";
import { botConfigSchema } from "@/lib/telegram/config";

/** Saytdagi AI konsultant (chat oynasi) */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1500) }))
    .min(1)
    .max(12),
});

// Oddiy himoya: bitta IP'dan daqiqasiga 8 ta savol (har bir server nusxasi ichida)
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 8;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "So'rov noto'g'ri" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (limited(`${slug}:${ip}`)) return NextResponse.json({ ok: false, error: "Juda tez yozyapsiz, birozdan keyin urinib ko'ring" }, { status: 429 });

  const db = createAdminClient();
  const site = await siteBySlug(db, slug);
  if (!site) return NextResponse.json({ ok: false, error: "Do'kon topilmadi" }, { status: 404 });
  const { data: bots } = await db.from("bots").select("config").eq("workspace_id", site.workspaceId);
  const cfg = (bots ?? []).map((b) => botConfigSchema.parse(b.config ?? {})).find((c) => c.aiSite);
  const plan = await getWorkspacePlan(db, site.workspaceId);
  if (!cfg || !plan.active) return NextResponse.json({ ok: false, error: "Konsultant o'chirilgan" }, { status: 403 });

  const msgs = parsed.data.messages;
  const question = msgs[msgs.length - 1].content;
  try {
    const answer = await answerCustomer(db, site.workspaceId, {
      history: msgs.slice(0, -1),
      question,
      channel: "site",
      instructions: cfg.aiInstructions,
      siteSlug: slug,
    });
    return NextResponse.json({ ok: true, answer });
  } catch (err) {
    console.error("Sayt AI:", err instanceof Error ? err.message : "xato");
    return NextResponse.json({ ok: false, error: err instanceof AIError && err.code === "rate_limited" ? "Hozir band, birozdan keyin yozing" : "Javob berib bo'lmadi" }, { status: 502 });
  }
}
