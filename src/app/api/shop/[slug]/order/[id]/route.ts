import { NextResponse, type NextRequest } from "next/server";
import { siteBySlug } from "@/lib/shop/site-lookup";
import { createAdminClient } from "@/lib/supabase/admin";

/** Buyurtma to'lov holati (saytdagi "to'lovni kutyapmiz" oynasi uchun). id — taxmin qilib bo'lmaydigan uuid. */

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const db = createAdminClient();
  const site = await siteBySlug(db, slug);
  if (!site) return NextResponse.json({ ok: false }, { status: 404 });
  const { data } = await db.from("orders").select("number, status, payment_status").eq("id", id).eq("workspace_id", site.workspaceId).maybeSingle();
  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, number: data.number, status: data.status, paymentStatus: data.payment_status });
}
