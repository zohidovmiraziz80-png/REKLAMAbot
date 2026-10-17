"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { connectFargo, fargoDirectory, saveFargoSettings } from "@/actions/delivery-extra";
import { disconnectIntegration } from "@/actions/integrations";

export async function connectFargoAction(input: { baseUrl: string; phone: string; password: string; token: string }) {
  const r = await runAction(connectFargo, input);
  if (r.ok) revalidatePath("/dashboard/integrations/fargo");
  return r;
}

export async function saveFargoSettingsAction(settings: Record<string, unknown>) {
  const r = await runAction(saveFargoSettings, { settings });
  if (r.ok) {
    revalidatePath("/dashboard/integrations/fargo");
    revalidatePath("/dashboard/integrations");
  }
  return r;
}

export async function fargoDirectoryAction(city?: string) {
  return runAction(fargoDirectory, { city });
}

export async function disconnectFargoAction() {
  const r = await runAction(disconnectIntegration, { provider: "fargo" }, { confirmed: true });
  if (r.ok) revalidatePath("/dashboard/integrations/fargo");
  return r;
}
