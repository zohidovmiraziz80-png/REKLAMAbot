"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { retryOrderSync } from "@/actions/integrations";
import { saveShopSettings, updateOrder } from "@/actions/shop";
import { assignOrderCourier, removeCourier, saveOrderAdmins } from "@/actions/couriers";
import { fargoCancelOrder, fargoDirectory, fargoEstimate, fargoSend, fargoTrack, noorCancelOrder, noorQuote, noorSend, noorTrack } from "@/actions/delivery-extra";
import { btsCancelOrder, btsDirectory, btsEstimate, btsSend, btsTrack, yandexCancel, yandexDispatch, yandexEstimate, yandexRefresh } from "@/actions/delivery";

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

export async function btsDirectoryAction(regionCode?: string) {
  return runAction(btsDirectory, { regionCode });
}

export async function btsEstimateAction(receiverCityCode: string, weight?: number) {
  return runAction(btsEstimate, { receiverCityCode, weight });
}

export async function btsSendAction(input: { orderId: string; receiverCityCode: string; dropoff: "courier" | "branch"; weight?: number; cod: boolean }) {
  // Foydalanuvchi narxni ko'rib tasdiqlagandan keyin
  const r = await runAction(btsSend, input, { confirmed: true });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function btsTrackAction(orderId: string) {
  const r = await runAction(btsTrack, { orderId });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function btsCancelAction(orderId: string) {
  const r = await runAction(btsCancelOrder, { orderId }, { confirmed: true });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function assignCourierAction(orderId: string, chatId: number) {
  const r = await runAction(assignOrderCourier, { orderId, chatId });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function removeCourierAction(chatId: number) {
  const r = await runAction(removeCourier, { chatId });
  revalidatePath("/dashboard/orders/settings");
  return r;
}

export async function saveOrderAdminsAction(ids: number[]) {
  const r = await runAction(saveOrderAdmins, { ids });
  revalidatePath("/dashboard/orders/settings");
  return r;
}

// ===== Noor (shahar ichida) =====

export async function noorQuoteAction(orderId: string, cod: boolean) {
  return runAction(noorQuote, { orderId, cod });
}

export async function noorSendAction(orderId: string, cod: boolean) {
  // Foydalanuvchi narxni ko'rib tasdiqlagandan keyin
  const r = await runAction(noorSend, { orderId, cod }, { confirmed: true });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function noorTrackAction(orderId: string) {
  const r = await runAction(noorTrack, { orderId });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function noorCancelAction(orderId: string) {
  const r = await runAction(noorCancelOrder, { orderId }, { confirmed: true });
  revalidatePath("/dashboard/orders");
  return r;
}

// ===== Fargo (viloyatlararo) =====

export async function fargoDirectoryAction(city?: string) {
  return runAction(fargoDirectory, { city });
}

export async function fargoEstimateAction(input: { city: string; district: string; toDoor: boolean; weight?: number }) {
  return runAction(fargoEstimate, input);
}

export async function fargoSendAction(input: { orderId: string; city: string; district: string; toDoor: boolean; weight?: number; cod: boolean }) {
  const r = await runAction(fargoSend, input, { confirmed: true });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function fargoTrackAction(orderId: string) {
  const r = await runAction(fargoTrack, { orderId });
  revalidatePath("/dashboard/orders");
  return r;
}

export async function fargoCancelAction(orderId: string) {
  const r = await runAction(fargoCancelOrder, { orderId }, { confirmed: true });
  revalidatePath("/dashboard/orders");
  return r;
}
