"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { saveCardPaySettings, unlinkPayChannel } from "@/actions/card-pay";

export async function saveCardAction(input: { enabled: boolean; cardNumber: string; cardHolder: string }) {
  const r = await runAction(saveCardPaySettings, input);
  if (r.ok) revalidatePath("/dashboard/integrations/card");
  return r;
}

export async function unlinkChannelAction() {
  const r = await runAction(unlinkPayChannel, {}, { confirmed: true });
  if (r.ok) revalidatePath("/dashboard/integrations/card");
  return r;
}
