import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureWorkspaceWebhooks } from "@/lib/telegram/webhook";
import { ActionError, defineAction } from "./define";

export type CardPaySetup = {
  enabled: boolean;
  cardNumber: string;
  cardHolder: string;
  channelCode: string;
  channelTitle: string | null;
  channelLinked: boolean;
  botUsername: string | null;
  recent: { id: string; amount: number; matched: boolean; orderNumber: number | null; createdAt: string; text: string }[];
};

export const getCardPaySetup = defineAction({
  name: "getCardPaySetup",
  description: "Kartaga o'tkazma sozlamalari: karta raqami, to'lov xabarlari kanali va oxirgi tushumlar.",
  input: z.object({}),
  handler: async (ctx): Promise<CardPaySetup> => {
    const db = createAdminClient();
    const [{ data: s }, { data: bots }, { data: tx }] = await Promise.all([
      db
        .from("shop_settings")
        .select("card_enabled, card_number, card_holder, pay_channel_code, pay_channel_chat_id, pay_channel_title")
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle(),
      db.from("bots").select("username").eq("workspace_id", ctx.workspaceId).order("created_at").limit(1),
      db
        .from("payment_transactions")
        .select("id, amount, order_id, created_at, raw")
        .eq("workspace_id", ctx.workspaceId)
        .eq("provider", "card")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    const orderIds = (tx ?? []).map((t) => t.order_id).filter(Boolean) as string[];
    const { data: orders } = orderIds.length ? await db.from("orders").select("id, number").in("id", orderIds) : { data: [] };
    const num = new Map((orders ?? []).map((o) => [o.id as string, o.number as number]));
    return {
      enabled: !!s?.card_enabled,
      cardNumber: (s?.card_number as string) ?? "",
      cardHolder: (s?.card_holder as string) ?? "",
      channelCode: (s?.pay_channel_code as string) ?? "",
      channelTitle: (s?.pay_channel_title as string | null) ?? null,
      channelLinked: !!s?.pay_channel_chat_id,
      botUsername: (bots?.[0]?.username as string | undefined) ?? null,
      recent: (tx ?? []).map((t) => ({
        id: t.id as string,
        amount: Number(t.amount),
        matched: !!t.order_id,
        orderNumber: t.order_id ? (num.get(t.order_id as string) ?? null) : null,
        createdAt: t.created_at as string,
        text: String((t.raw as { text?: string } | null)?.text ?? "").slice(0, 200),
      })),
    };
  },
});

export const saveCardPaySettings = defineAction({
  name: "saveCardPaySettings",
  description: "Kartaga o'tkazma to'lov usulini yoqadi/o'chiradi, karta raqami va egasini saqlaydi.",
  input: z.object({
    enabled: z.boolean(),
    cardNumber: z.string().trim().max(32),
    cardHolder: z.string().trim().max(80).default(""),
  }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const digits = input.cardNumber.replace(/\D/g, "");
    if (input.enabled && (digits.length < 16 || digits.length > 19)) throw new ActionError("validation", "Karta raqami 16 xonali bo'lishi kerak");
    const pretty = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    const row = { card_enabled: input.enabled, card_number: pretty, card_holder: input.cardHolder };
    const { data: existing } = await ctx.supabase.from("shop_settings").select("workspace_id").eq("workspace_id", ctx.workspaceId).maybeSingle();
    const { error } = existing
      ? await ctx.supabase.from("shop_settings").update(row).eq("workspace_id", ctx.workspaceId)
      : await ctx.supabase.from("shop_settings").insert({ ...row, workspace_id: ctx.workspaceId });
    if (error) throw new ActionError("internal", "Saqlanmadi");
    // Bot kanal xabarlarini olishi uchun webhook yangilanadi
    await ensureWorkspaceWebhooks(createAdminClient(), ctx.workspaceId);
    return { cardNumber: pretty };
  },
});

export const unlinkPayChannel = defineAction({
  name: "unlinkPayChannel",
  description: "To'lov xabarlari kanalini uzadi.",
  input: z.object({}),
  minRole: "admin",
  handler: async (ctx) => {
    const db = createAdminClient();
    await db
      .from("shop_settings")
      .update({ pay_channel_chat_id: null, pay_channel_title: null, pay_channel_bot_project_id: null, pay_channel_code: Math.random().toString(36).slice(2, 12) })
      .eq("workspace_id", ctx.workspaceId);
    return { ok: true };
  },
});
