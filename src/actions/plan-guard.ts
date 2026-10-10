import { getWorkspacePlan } from "@/lib/plans";
import { ActionError, type ActionContext } from "./define";

/** Workspace tarifida kerakli imkoniyat borligini tekshiradi */
export async function requireFeature(ctx: ActionContext, feature: "sites" | "bots" | "integrations" | "publicSite") {
  const plan = await getWorkspacePlan(ctx.supabase, ctx.workspaceId);
  if (!plan.active) {
    throw new ActionError("forbidden", "Sinov muddati tugagan. Davom etish uchun \"Tarif\" bo'limida tarifni faollashtiring.");
  }
  if (feature === "sites" && !plan.allowSites) {
    throw new ActionError("forbidden", `"${plan.planName}" tarifida sayt yo'q. "Tarif" bo'limida boshqa tarifga o'ting.`);
  }
  if (feature === "bots" && !plan.allowBots) {
    throw new ActionError("forbidden", `"${plan.planName}" tarifida Telegram bot yo'q. "Tarif" bo'limida boshqa tarifga o'ting.`);
  }
  if (feature === "integrations" && !plan.integrations) {
    throw new ActionError("forbidden", `Integratsiyalar (Bito, Payme, Click, Multicard) faqat "Biznes" tarifida. "Tarif" bo'limida Biznes tarifiga o'ting.`);
  }
  if (feature === "publicSite" && !plan.sitePublic) {
    throw new ActionError("forbidden", `"${plan.planName}" tarifida sayt faqat Telegram bot ichida ochiladi — o'z domenini ulab bo'lmaydi. "Sayt" yoki "Sayt + Bot" tarifiga o'ting.`);
  }
  return plan;
}
