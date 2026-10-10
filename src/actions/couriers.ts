import { z } from "zod";
import { assignCourier, CourierError } from "@/lib/couriers";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkCode, loadMainBot, updateBotConfig } from "@/lib/telegram/main-bot";
import { ActionError, defineAction } from "./define";

export type CourierSetup = { hasBot: boolean; joinLink: string | null; couriers: { chatId: number; name: string }[] };

export const getCourierSetup = defineAction({
  name: "getCourierSetup",
  description: "Do'kon kuryerlari ro'yxati va kuryerni ulash havolasi.",
  input: z.object({}),
  handler: async (ctx): Promise<CourierSetup> => {
    const bot = await loadMainBot(createAdminClient(), ctx.workspaceId);
    if (!bot) return { hasBot: false, joinLink: null, couriers: [] };
    return { hasBot: true, joinLink: `https://t.me/${bot.username}?start=courier_${linkCode(bot.linkCode, "courier")}`, couriers: bot.config.couriers };
  },
});

export const removeCourier = defineAction({
  name: "removeCourier",
  description: "Kuryerni ro'yxatdan chiqaradi.",
  input: z.object({ chatId: z.number().int() }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const db = createAdminClient();
    const bot = await loadMainBot(db, ctx.workspaceId);
    if (!bot) throw new ActionError("validation", "Bot ulanmagan");
    await updateBotConfig(db, bot.projectId, { couriers: bot.config.couriers.filter((c) => c.chatId !== input.chatId) });
    return { ok: true };
  },
});

export const assignOrderCourier = defineAction({
  name: "assignOrderCourier",
  description: "Buyurtmani do'kon kuryeriga biriktiradi: kuryerga Telegram'da manzil, telefon va xarita boradi, buyurtma «Yetkazilmoqda» bo'ladi.",
  input: z.object({ orderId: z.string().uuid(), chatId: z.number().int() }),
  handler: async (ctx, input) => {
    try {
      const name = await assignCourier(createAdminClient(), ctx.workspaceId, input.orderId, input.chatId);
      return { name };
    } catch (err) {
      if (err instanceof CourierError) throw new ActionError("validation", err.message);
      throw err;
    }
  },
});
