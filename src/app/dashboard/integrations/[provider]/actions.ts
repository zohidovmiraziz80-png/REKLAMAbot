"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { connectPayProvider, disconnectIntegration } from "@/actions/integrations";

export async function connectPayAction(provider: "payme" | "click" | "multicard", settings: Record<string, unknown>, secret: string) {
  const r = await runAction(connectPayProvider, { provider, settings, secret });
  if (r.ok) {
    revalidatePath(`/dashboard/integrations/${provider}`);
    revalidatePath("/dashboard/integrations");
  }
  return r;
}

export async function disconnectPayAction(provider: "payme" | "click" | "multicard") {
  // Foydalanuvchi tasdiqlash oynasini bosgandan keyin chaqiriladi
  const r = await runAction(disconnectIntegration, { provider }, { confirmed: true });
  if (r.ok) {
    revalidatePath(`/dashboard/integrations/${provider}`);
    revalidatePath("/dashboard/integrations");
  }
  return r;
}
