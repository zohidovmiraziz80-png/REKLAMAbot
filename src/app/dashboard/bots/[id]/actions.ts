"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { connectBot, disconnectBot, getBot, saveBotConfig, updateBotRequestStatus } from "@/actions/bots";

function refresh(projectId: string) {
  revalidatePath(`/dashboard/bots/${projectId}`);
}

export async function connectBotAction(projectId: string, token: string) {
  const result = await runAction(connectBot, { projectId, token });
  if (result.ok) refresh(projectId);
  return result;
}

export async function getBotAction(projectId: string) {
  return runAction(getBot, { projectId });
}

export async function saveBotConfigAction(projectId: string, config: unknown) {
  const result = await runAction(saveBotConfig, { projectId, config });
  if (result.ok) refresh(projectId);
  return result;
}

export async function disconnectBotAction(projectId: string) {
  // Foydalanuvchi tasdiqlash oynasini bosgandan keyin chaqiriladi
  const result = await runAction(disconnectBot, { projectId }, { confirmed: true });
  if (result.ok) refresh(projectId);
  return result;
}

export async function updateRequestStatusAction(projectId: string, requestId: number, status: string) {
  return runAction(updateBotRequestStatus, { projectId, requestId, status });
}
