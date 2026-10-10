"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { retryOrderSync } from "@/actions/integrations";
import { saveShopSettings, updateOrder } from "@/actions/shop";
import { yandexCancel, yandexDispatch, yandexEstimate, yandexRefresh } from "@/actions/delivery";

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

export async function retryOrderSyncAction(orderId: string) {
  const r = await runAction(retryOrderSync, { orderId });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function yandexEstimateAction(orderId: string) {
  return runAction(yandexEstimate, { orderId });
}

export async function yandexDispatchAction(orderId: string) {
  // Foydalanuvchi narxni ko'rib "Chaqirish" ni bosgandan keyin
  const r = await runAction(yandexDispatch, { orderId }, { confirmed: true });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function yandexRefreshAction(orderId: string) {
  const r = await runAction(yandexRefresh, { orderId });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function yandexCancelAction(orderId: string) {
  const r = await runAction(yandexCancel, { orderId }, { confirmed: true });
  revalidatePath("/dashboard/orders");
  return r;
}
