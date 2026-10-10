"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { saveShopSettings, updateOrder } from "@/actions/shop";

export async function updateOrderAction(input: { id: string; status?: string; paymentStatus?: string; adminNote?: string }) {
  const r = await runAction(updateOrder, input);
  if (r.ok) revalidatePath("/dashboard/orders");
  return r;
}

export async function saveShopSettingsAction(input: unknown) {
  const r = await runAction(saveShopSettings, input);
  if (r.ok) revalidatePath("/dashboard/orders/settings");
  return r;
}
