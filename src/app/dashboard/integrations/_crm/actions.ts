"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { connectCrm } from "@/actions/crm";
import { disconnectIntegration } from "@/actions/integrations";

export async function connectCrmAction(provider: "bitrix24" | "amocrm", settings: Record<string, unknown>, secret: string) {
  const r = await runAction(connectCrm, { provider, settings, secret });
  if (r.ok) {
    revalidatePath(`/dashboard/integrations/${provider}`);
    revalidatePath("/dashboard/integrations");
  }
  return r;
}

export async function disconnectCrmAction(provider: "bitrix24" | "amocrm") {
  const r = await runAction(disconnectIntegration, { provider }, { confirmed: true });
  if (r.ok) revalidatePath(`/dashboard/integrations/${provider}`);
  return r;
}
