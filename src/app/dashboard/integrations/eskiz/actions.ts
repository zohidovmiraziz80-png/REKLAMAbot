"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { disconnectIntegration } from "@/actions/integrations";
import { connectEskiz, sendTestSms } from "@/actions/sms";

export async function connectEskizAction(settings: Record<string, unknown>, password: string) {
  const r = await runAction(connectEskiz, { settings, password });
  if (r.ok) {
    revalidatePath("/dashboard/integrations/eskiz");
    revalidatePath("/dashboard/integrations");
  }
  return r;
}

export async function testSmsAction(phone: string) {
  // Foydalanuvchi "Sinov SMS" tugmasini bosgandan keyin (bitta pullik SMS)
  return runAction(sendTestSms, { phone }, { confirmed: true });
}

export async function disconnectEskizAction() {
  const r = await runAction(disconnectIntegration, { provider: "eskiz" }, { confirmed: true });
  if (r.ok) revalidatePath("/dashboard/integrations/eskiz");
  return r;
}
