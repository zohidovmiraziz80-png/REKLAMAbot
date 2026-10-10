import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { evaluatePromo } from "@/lib/shop/promo";
import { siteBySlug } from "@/lib/shop/site-lookup";
import { createAdminClient } from "@/lib/supabase/admin";

/** Checkout'da promo-kodni tekshirish (yakuniy hisob buyurtma yaratilganda serverda qayta qilinadi) */
export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().max(40), subtotal: z.number().min(0).max(1e12) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "So'rov noto'g'ri" }, { status: 400 });
  const db = createAdminClient();
  const site = await siteBySlug(db, slug);
  if (!site) return NextResponse.json({ ok: false, error: "Do'kon topilmadi" }, { status: 404 });
  const r = await evaluatePromo(db, site.workspaceId, parsed.data.code, parsed.data.subtotal);
  return NextResponse.json(r.ok ? { ok: true, code: r.promo.code, discount: r.discount, label: r.label } : r);
}
