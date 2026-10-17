"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { connectNoor } from "@/actions/delivery-extra";
import { disconnectIntegration } from "@/actions/integrations";

export async function connectNoorAction(settings: Record<string, unknown>, token: string) {
  const r = await runAction(connectNoor, { settings, token });
  if (r.ok) {
    revalidatePath("/dashboard/integrations/noor");
    revalidatePath("/dashboard/integrations");
  }
  return r;
}

export async function disconnectNoorAction() {
  const r = await runAction(disconnectIntegration, { provider: "noor" }, { confirmed: true });
  if (r.ok) revalidatePath("/dashboard/integrations/noor");
  return r;
}
