import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { loadPayConfigs } from "@/lib/payments/config";
import { markOrderPaid, markOrderRefunded } from "@/lib/payments/core";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payme Merchant API (JSON-RPC 2.0): https://developer.help.paycom.uz
 * Kabinetda "Endpoint URL": https://<platforma>/api/pay/payme/<workspaceId>, hisob maydoni: order_id
 */

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 12 * 3600 * 1000; // Payme: 12 soat ichida yakunlanmasa bekor qilinadi

type Rpc = { id?: number | string; method?: string; params?: Record<string, unknown> };

const msg = (text: string) => ({ uz: text, ru: text, en: text });

function reply(id: Rpc["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}
function fail(id: Rpc["id"], code: number, text: string, data?: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message: msg(text), ...(data ? { data } : {}) } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  let body: Rpc;
  try {
    body = (await request.json()) as Rpc;
  } catch {
    return fail(null, -32700, "JSON xato");
  }
  const id = body.id;
  if (!/^[0-9a-f-]{36}$/i.test(ws)) return fail(id, -32504, "Ruxsat yo'q");

  let db;
  try {
    db = createAdminClient();
  } catch {
    return fail(id, -32400, "Server xatosi");
  }
  const cfg = (await loadPayConfigs(db, ws)).payme;
  // Avtorizatsiya: Basic base64("Paycom:<kalit>")
  const auth = request.headers.get("authorization") ?? "";
  const decoded = auth.startsWith("Basic ") ? Buffer.from(auth.slice(6), "base64").toString("utf8") : "";
  const key = decoded.split(":").slice(1).join(":");
  if (!cfg || !key || !safeEqual(key, cfg.key)) return fail(id, -32504, "Ruxsat yo'q");

  const p = body.params ?? {};
  const account = (p.account ?? {}) as Record<string, unknown>;

  const loadOrder = async (orderId: unknown) => {
    if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) return null;
    const { data } = await db.from("orders").select("id, total, status, payment_status").eq("id", orderId).eq("workspace_id", ws).maybeSingle();
    return data;
  };
  const loadTx = async (txId: unknown) => {
    if (typeof txId !== "string") return null;
    const { data } = await db.from("payment_transactions").select("*").eq("provider", "payme").eq("external_id", txId).eq("workspace_id", ws).maybeSingle();
    return data;
  };
  const txResult = (t: Record<string, unknown>) => ({
    create_time: Number(t.create_time),
    perform_time: Number(t.perform_time),
    cancel_time: Number(t.cancel_time),
    transaction: t.id,
    state: t.state,
    reason: t.reason ?? null,
  });

  switch (body.method) {
    case "CheckPerformTransaction": {
      const order = await loadOrder(account.order_id);
      if (!order) return fail(id, -31050, "Buyurtma topilmadi", "order_id");
      if (order.status === "cancelled" || order.payment_status === "paid") return fail(id, -31051, "Buyurtmani to'lab bo'lmaydi", "order_id");
      if (Number(p.amount) !== Number(order.total) * 100) return fail(id, -31001, "Summa noto'g'ri");
      return reply(id, { allow: true });
    }

    case "CreateTransaction": {
      const existing = await loadTx(p.id);
      if (existing) {
        if (existing.state !== 1) return fail(id, -31008, "Tranzaksiyani bajarib bo'lmaydi");
        if (Date.now() - Number(existing.provider_time) > TIMEOUT_MS) {
          await db.from("payment_transactions").update({ state: -1, reason: 4, cancel_time: Date.now() }).eq("id", existing.id);
          return fail(id, -31008, "Tranzaksiya muddati o'tgan");
        }
        return reply(id, { create_time: Number(existing.create_time), transaction: existing.id, state: existing.state });
      }
      const order = await loadOrder(account.order_id);
      if (!order) return fail(id, -31050, "Buyurtma topilmadi", "order_id");
      if (order.status === "cancelled" || order.payment_status === "paid") return fail(id, -31051, "Buyurtmani to'lab bo'lmaydi", "order_id");
      if (Number(p.amount) !== Number(order.total) * 100) return fail(id, -31001, "Summa noto'g'ri");
      // Bir buyurtmaga bir vaqtda faqat bitta faol Payme tranzaksiyasi
      const { data: busy } = await db.from("payment_transactions").select("id").eq("provider", "payme").eq("order_id", order.id).eq("state", 1).limit(1);
      if (busy?.length) return fail(id, -31052, "Buyurtma bo'yicha boshqa to'lov kutilmoqda", "order_id");
      const createTime = Date.now();
      const { data: tx, error } = await db
        .from("payment_transactions")
        .insert({
          workspace_id: ws,
          order_id: order.id,
          provider: "payme",
          external_id: String(p.id),
          amount: Number(order.total),
          state: 1,
          provider_time: Number(p.time) || createTime,
          create_time: createTime,
          raw: p,
        })
        .select("id, create_time, state")
        .single();
      if (error || !tx) return fail(id, -31008, "Tranzaksiya yaratilmadi");
      await db.from("orders").update({ payment_method: "payme" }).eq("id", order.id);
      return reply(id, { create_time: Number(tx.create_time), transaction: tx.id, state: 1 });
    }

    case "PerformTransaction": {
      const tx = await loadTx(p.id);
      if (!tx) return fail(id, -31003, "Tranzaksiya topilmadi");
      if (tx.state === 2) return reply(id, { transaction: tx.id, perform_time: Number(tx.perform_time), state: 2 });
      if (tx.state !== 1) return fail(id, -31008, "Tranzaksiyani bajarib bo'lmaydi");
      if (Date.now() - Number(tx.provider_time) > TIMEOUT_MS) {
        await db.from("payment_transactions").update({ state: -1, reason: 4, cancel_time: Date.now() }).eq("id", tx.id);
        return fail(id, -31008, "Tranzaksiya muddati o'tgan");
      }
      const performTime = Date.now();
      await db.from("payment_transactions").update({ state: 2, perform_time: performTime }).eq("id", tx.id);
      if (tx.order_id) await markOrderPaid(db, tx.order_id as string, "payme");
      return reply(id, { transaction: tx.id, perform_time: performTime, state: 2 });
    }

    case "CancelTransaction": {
      const tx = await loadTx(p.id);
      if (!tx) return fail(id, -31003, "Tranzaksiya topilmadi");
      if (tx.state === -1 || tx.state === -2) return reply(id, { transaction: tx.id, cancel_time: Number(tx.cancel_time), state: tx.state });
      const cancelTime = Date.now();
      const state = tx.state === 2 ? -2 : -1;
      await db.from("payment_transactions").update({ state, reason: Number(p.reason) || null, cancel_time: cancelTime }).eq("id", tx.id);
      if (state === -2 && tx.order_id) await markOrderRefunded(db, tx.order_id as string);
      return reply(id, { transaction: tx.id, cancel_time: cancelTime, state });
    }

    case "CheckTransaction": {
      const tx = await loadTx(p.id);
      if (!tx) return fail(id, -31003, "Tranzaksiya topilmadi");
      return reply(id, txResult(tx));
    }

    case "GetStatement": {
      const from = Number(p.from) || 0;
      const to = Number(p.to) || Date.now();
      const { data } = await db
        .from("payment_transactions")
        .select("*")
        .eq("provider", "payme")
        .eq("workspace_id", ws)
        .gte("provider_time", from)
        .lte("provider_time", to)
        .order("provider_time", { ascending: true })
        .limit(1000);
      return reply(id, {
        transactions: (data ?? []).map((t) => ({
          id: t.external_id,
          time: Number(t.provider_time),
          amount: Number(t.amount) * 100,
          account: { order_id: t.order_id },
          ...txResult(t),
        })),
      });
    }

    default:
      return fail(id, -32601, "Metod topilmadi");
  }
}
