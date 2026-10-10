import { z } from "zod";
import { getWorkspacePlan, listPlans, type Plan, type WorkspacePlan } from "@/lib/plans";
import { defineAction } from "./define";

export const getMyPlan = defineAction({
  name: "getMyPlan",
  description: "Joriy workspace tarifi (Bot, Sayt yoki Sayt + Bot), sinov muddati va barcha tariflar ro'yxatini qaytaradi",
  input: z.object({}),
  handler: async (ctx): Promise<{ current: WorkspacePlan; plans: Plan[] }> => {
    const [current, plans] = await Promise.all([getWorkspacePlan(ctx.supabase, ctx.workspaceId), listPlans(ctx.supabase)]);
    return { current, plans };
  },
});
