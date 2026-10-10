"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { deletePromo, postToChannel, savePromo, sendBroadcastChunk, sendBroadcastTest, setAutoPost, setPromoActive, unlinkPostChannel } from "@/actions/marketing";

type Msg = { botProjectId: string; text: string; buttonText: string; buttonUrl: string };

export async function broadcastTestAction(input: Msg) {
  return runAction(sendBroadcastTest, input);
}

export async function broadcastChunkAction(input: Msg & { offset: number }) {
  // Foydalanuvchi "Hammaga yuborish" ni tasdiqlagandan keyin chaqiriladi
  return runAction(sendBroadcastChunk, input, { confirmed: true });
}

export async function savePromoAction(input: { code: string; kind: "percent" | "fixed"; value: number; minOrder: number; maxUses: number | null; expiresAt: string | null }) {
  const r = await runAction(savePromo, input);
  if (r.ok) revalidatePath("/dashboard/marketing");
  return r;
}

export async function setPromoActiveAction(id: string, active: boolean) {
  const r = await runAction(setPromoActive, { id, active });
  if (r.ok) revalidatePath("/dashboard/marketing");
  return r;
}

export async function deletePromoAction(id: string) {
  const r = await runAction(deletePromo, { id }, { confirmed: true });
  if (r.ok) revalidatePath("/dashboard/marketing");
  return r;
}

export async function setAutoPostAction(enabled: boolean) {
  const r = await runAction(setAutoPost, { enabled });
  if (r.ok) revalidatePath("/dashboard/marketing");
  return r;
}

export async function unlinkPostChannelAction() {
  const r = await runAction(unlinkPostChannel, {});
  if (r.ok) revalidatePath("/dashboard/marketing");
  return r;
}

export async function postToChannelAction(input: { text: string; imageUrl: string; buttonText: string; buttonUrl: string }) {
  return runAction(postToChannel, input);
}
