import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { loadPayConfigs } from "@/lib/payments/config";
import { markOrderPaid } from "@/lib/payments/core";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Click SHOP API: Prepare (action=0) va Complete (action=1).
 * Kabinetda Prepare URL va Complete URL ikkalasiga ham: https://<platforma>/api/pay/click/<workspaceId>
 */

export const dynamic = "force-dynamic";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

export async function POST(request: NextRequest, { params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  let f: Record<string, string> = {};
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) f = (await request.json()) as Record<string, string>;
    else f = Object.fromEntries((await request.formData()).entries()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: -8, error_note: "Error in request from click" });
  }
  const v = (k: string) => String(f[k] ?? "");
  const base = { click_trans_id: v("click_trans_id"), merchant_trans_id: v("merchant_trans_id") };
  const out = (error: number, error_note: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ...base, ...extra, error, error_note });

  if (!/^[0-9a-f-]{36}$/i.test(ws)) return out(-5, "User does not exist");
  let db;
  try {
    db = createAdminClient();
  } catch {
    return out(-7, "Failed to update user");
  }
  const cfg = (await loadPayConfigs(db, ws)).click;
  if (!cfg) return out(-8, "Error in request from click");

  const action = v("action");
  const expected =
    action === "1"
      ? md5(`${v("click_trans_id")}${v("service_id")}${cfg.secretKey}${v("merchant_trans_id")}${v("merchant_prepare_id")}${v("amount")}${v("action")}${v("sign_time")}`)
      : md5(`${v("click_trans_id")}${v("service_id")}${cfg.secretKey}${v("merchant_trans_id")}${v("amount")}${v("action")}${v("sign_time")}`);
  if (!v("sign_string") || !safeEqual(v("sign_string").toLowerCase(), expected)) return out(-1, "SIGN CHECK FAILED!");
  if (v("service_id") !== cfg.serviceId) return out(-8, "Error in request from click");
  if (action !== "0" && action !== "1") return out(-3, "Action not found");

  const orderId = v("merchant_trans_id");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return out(-5, "User does not exist");
  const { data: order } = await db.from("orders").select("id, total, status, payment_status").eq("id", orderId).eq("workspace_id", ws).maybeSingle();
  if (!order) return out(-5, "User does not exist");
  if (Math.abs(Number(v("amount")) - Number(order.total)) > 0.01) return out(-2, "Incorrect parameter amount");

  if (action === "0") {
    if (order.payment_status === "paid") return out(-4, "Already paid");
    if (order.status === "cancelled") return out(-9, "Transaction cancelled");
    const { data: tx } = await db
      .from("payment_transactions")
      .upsert(
        { workspace_id: ws, order_id: order.id, provider: "click", external_id: v("click_trans_id"), amount: Number(order.total), state: 1, raw: f },
        { onConflict: "provider,external_id" },
      )
      .select("id, create_time")
      .single();
    if (!tx) return out(-7, "Failed to update user");
    await db.from("orders").update({ payment_method: "click" }).eq("id", order.id);
    return out(0, "Success", { merchant_prepare_id: Number(tx.create_time) });
  }

  // Complete
  const { data: tx } = await db.from("payment_transactions").select("id, state, create_time").eq("provider", "click").eq("external_id", v("click_trans_id")).eq("workspace_id", ws).maybeSingle();
  if (!tx || String(tx.create_time) !== v("merchant_prepare_id")) return out(-6, "Transaction does not exist");
  if (tx.state === 2 || order.payment_status === "paid") return out(-4, "Already paid", { merchant_confirm_id: Number(tx.create_time) });
  if (tx.state === -1) return out(-9, "Transaction cancelled");
  if (Number(v("error")) < 0) {
    await db.from("payment_transactions").update({ state: -1, cancel_time: Date.now(), reason: Number(v("error")) }).eq("id", tx.id);
    return out(-9, "Transaction cancelled");
  }
  await db.from("payment_transactions").update({ state: 2, perform_time: Date.now() }).eq("id", tx.id);
  await markOrderPaid(db, order.id as string, "click");
  return out(0, "Success", { merchant_confirm_id: Number(tx.create_time) });
}
