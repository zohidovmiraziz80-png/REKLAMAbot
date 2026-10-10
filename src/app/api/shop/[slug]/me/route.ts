import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/shop/customer-session";
import { SESSION_HEADER, siteBySlug } from "@/lib/shop/site-lookup";
import { createAdminClient } from "@/lib/supabase/admin";

/** Mijoz kabineti: ma'lumotlari va buyurtmalari (sessiya tokeni bilan) */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createAdminClient();
  const site = await siteBySlug(db, slug);
  if (!site) return NextResponse.json({ ok: false, error: "Do'kon topilmadi" }, { status: 404 });
  const s = verifySession(req.headers.get(SESSION_HEADER), site.workspaceId);
  if (!s) return NextResponse.json({ ok: false, error: "Qayta kiring" }, { status: 401 });

  const [{ data: customer }, { data: orders }] = await Promise.all([
    db.from("customers").select("name, phone, address, orders_count, total_spent").eq("workspace_id", site.workspaceId).eq("phone", s.p).maybeSingle(),
    (async () => {
      const q = (cols: string) =>
        db.from("orders").select(cols).eq("workspace_id", site.workspaceId).eq("phone", s.p).order("created_at", { ascending: false }).limit(30);
      const r = await q("id, number, status, payment_status, payment_method, pay_amount, total, subtotal, delivery_price, discount, address, comment, items, delivery_method, created_at");
      // pay_amount ustuni hali bazada bo'lmasa
      return r.error ? await q("id, number, status, payment_status, payment_method, total, subtotal, delivery_price, address, comment, items, delivery_method, created_at") : r;
    })(),
  ]);
  return NextResponse.json({
    ok: true,
    customer: { name: (customer?.name as string | null) ?? s.n, phone: s.p, address: (customer?.address as string | null) ?? "" },
    orders: orders ?? [],
  });
}
