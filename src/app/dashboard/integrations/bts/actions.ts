"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { btsDirectory, connectBts, saveBtsSettings } from "@/actions/delivery";
import { disconnectIntegration } from "@/actions/integrations";

export async function connectBtsAction(input: { baseUrl: string; login: string; password: string }) {
  const r = await runAction(connectBts, input);
  if (r.ok) revalidatePath("/dashboard/integrations/bts");
  return r;
}

export async function saveBtsSettingsAction(settings: Record<string, unknown>) {
  const r = await runAction(saveBtsSettings, { settings });
  if (r.ok) {
    revalidatePath("/dashboard/integrations/bts");
    revalidatePath("/dashboard/integrations");
  }
  return r;
}

export async function btsDirectoryAction(regionCode?: string) {
  return runAction(btsDirectory, { regionCode });
}

export async function disconnectBtsAction() {
  const r = await runAction(disconnectIntegration, { provider: "bts" }, { confirmed: true });
  if (r.ok) revalidatePath("/dashboard/integrations/bts");
  return r;
}
