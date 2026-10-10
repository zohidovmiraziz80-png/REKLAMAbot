"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { connectBito, disconnectIntegration, saveBitoSettings, syncBitoNow } from "@/actions/integrations";

const refresh = () => {
  revalidatePath("/dashboard/integrations/bito");
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/products");
};

export async function connectBitoAction(apiKey: string) {
  const r = await runAction(connectBito, { apiKey });
  if (r.ok) refresh();
  return r;
}

export async function saveBitoSettingsAction(input: unknown) {
  const r = await runAction(saveBitoSettings, input);
  if (r.ok) refresh();
  return r;
}

export async function syncBitoAction() {
  const r = await runAction(syncBitoNow, {});
  refresh();
  return r;
}

export async function disconnectBitoAction() {
  // Foydalanuvchi tasdiqlash oynasini bosgandan keyin chaqiriladi
  const r = await runAction(disconnectIntegration, { provider: "bito" }, { confirmed: true });
  if (r.ok) refresh();
  return r;
}
