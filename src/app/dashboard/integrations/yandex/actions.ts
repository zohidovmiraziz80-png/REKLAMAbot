"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { connectYandex } from "@/actions/delivery";
import { disconnectIntegration } from "@/actions/integrations";

export async function connectYandexAction(settings: Record<string, unknown>, token: string) {
  const r = await runAction(connectYandex, { settings, token });
  if (r.ok) {
    revalidatePath("/dashboard/integrations/yandex");
    revalidatePath("/dashboard/integrations");
  }
  return r;
}

export async function disconnectYandexAction() {
  const r = await runAction(disconnectIntegration, { provider: "yandex" }, { confirmed: true });
  if (r.ok) revalidatePath("/dashboard/integrations/yandex");
  return r;
}
