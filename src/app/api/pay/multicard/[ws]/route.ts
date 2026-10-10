import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { loadPayConfigs } from "@/lib/payments/config";
import { markOrderPaid } from "@/lib/payments/core";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Multicard: muvaffaqiyatli to'lovdan keyin callback. sign = md5(store_id + invoice_id + amount + secret).
 * Manzil invoys yaratilganda avtomatik beriladi: https://<platforma>/api/pay/multicard/<workspaceId>
 */

export const dynamic = "force-dynamic";

const no = (message: string) => NextResponse.json({ success: false, message }, { status: 400 });

export async function POST(request: NextRequest, { params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return no("So'rov noto'g'ri");
  }
  if (!/^[0-9a-f-]{36}$/i.test(ws)) return no("Do'kon topilmadi");
  let db;
  try {
    db = createAdminClient();
  } catch {
    return NextResponse.json({ success: false, message: "Server xatosi" }, { status: 500 });
  }
  const cfg = (await loadPayConfigs(db, ws)).multicard;
  if (!cfg) return no("To'lov sozlanmagan");

  const storeId = String(b.store_id ?? "");
  const invoiceId = String(b.invoice_id ?? "");
  const amount = String(b.amount ?? "");
  const expected = createHash("md5").update(`${storeId}${invoiceId}${amount}${cfg.secret}`).digest("hex");
  if (!b.sign || !safeEqual(String(b.sign).toLowerCase(), expected)) return no("Imzo noto'g'ri");
  if (storeId !== cfg.storeId) return no("Do'kon mos emas");
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return no("Invoys topilmadi");

  const { data: order } = await db.from("orders").select("id, total, status, payment_status").eq("id", invoiceId).eq("workspace_id", ws).maybeSingle();
  if (!order) return no("Invoys topilmadi");
  if (Number(amount) !== Number(order.total) * 100) return no("Summa mos emas");
  if (order.status === "cancelled" && order.payment_status !== "paid") return no("Buyurtma bekor qilingan");

  const uuid = String(b.uuid ?? invoiceId);
  await db.from("payment_transactions").upsert(
    { workspace_id: ws, order_id: order.id, provider: "multicard", external_id: uuid, amount: Number(order.total), state: 2, perform_time: Date.now(), raw: b },
    { onConflict: "provider,external_id" },
  );
  await markOrderPaid(db, order.id as string, "multicard");
  return NextResponse.json({ success: true, message: "OK" });
}
