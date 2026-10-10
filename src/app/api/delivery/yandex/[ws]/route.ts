import { NextResponse, type NextRequest } from "next/server";
import { refreshByClaim, refreshYandex } from "@/lib/delivery/yandex-flow";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Yandex Delivery holat bildirishnomasi. So'rov tanasiga ishonmaymiz:
 * faqat qaysi buyurtma o'zgarganini bilib olamiz va holatni o'z tokenimiz bilan Yandex'dan qayta o'qiymiz.
 */

export const dynamic = "force-dynamic";

async function handle(request: NextRequest, { params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(ws)) return NextResponse.json({ ok: false }, { status: 404 });
  const q = request.nextUrl.searchParams;
  const orderId = q.get("order") ?? "";
  const claimId = q.get("claim_id") ?? "";
  const db = createAdminClient();
  try {
    if (/^[0-9a-f-]{36}$/i.test(orderId)) await refreshYandex(db, ws, orderId);
    else if (/^[0-9a-z-]{8,64}$/i.test(claimId)) await refreshByClaim(db, ws, claimId);
  } catch (err) {
    console.error("Yandex callback:", err instanceof Error ? err.message : "xato");
  }
  return NextResponse.json({ ok: true });
}

export const POST = handle;
export const GET = handle;
