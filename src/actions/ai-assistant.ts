import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { botConfigSchema } from "@/lib/telegram/config";
import { ActionError, defineAction } from "./define";

export type AiSettings = { hasBot: boolean; aiBot: boolean; aiSite: boolean; aiInstructions: string };

export const getAiSettings = defineAction({
  name: "getAiSettings",
  description: "AI yordamchi sozlamalari: Telegram botda va saytda javob berish, qo'shimcha ko'rsatmalar.",
  input: z.object({}),
  handler: async (ctx): Promise<AiSettings> => {
    const { data } = await createAdminClient().from("bots").select("config").eq("workspace_id", ctx.workspaceId).order("created_at").limit(1).maybeSingle();
    if (!data) return { hasBot: false, aiBot: false, aiSite: false, aiInstructions: "" };
    const c = botConfigSchema.parse(data.config ?? {});
    return { hasBot: true, aiBot: c.aiBot, aiSite: c.aiSite, aiInstructions: c.aiInstructions };
  },
});

export const saveAiSettings = defineAction({
  name: "saveAiSettings",
  description: "AI yordamchini yoqadi/o'chiradi (bot va sayt) va unga do'kon haqida qo'shimcha ko'rsatma beradi.",
  input: z.object({ aiBot: z.boolean(), aiSite: z.boolean(), aiInstructions: z.string().max(2000).default("") }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const db = createAdminClient();
    const { data: bots } = await db.from("bots").select("project_id, config").eq("workspace_id", ctx.workspaceId);
    if (!bots?.length) throw new ActionError("validation", "Avval Telegram botni ulang — AI sozlamalari bot bilan saqlanadi");
    for (const b of bots) {
      const cfg = botConfigSchema.parse(b.config ?? {});
      await db
        .from("bots")
        .update({ config: { ...cfg, aiBot: input.aiBot, aiSite: input.aiSite, aiInstructions: input.aiInstructions.trim() } })
        .eq("project_id", b.project_id);
    }
    return { ok: true };
  },
});
