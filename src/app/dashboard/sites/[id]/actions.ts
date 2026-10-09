"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { editWebsiteWithAI, generateWebsite, saveWebsite } from "@/actions/websites";

// Tahrirlovchi tugmalari amallar qatlamini shu Server Action'lar orqali chaqiradi.

function refresh(projectId: string) {
  revalidatePath(`/dashboard/sites/${projectId}`);
  revalidatePath(`/preview/${projectId}`, "layout");
}

export async function generateWebsiteAction(projectId: string, brief: Record<string, string>) {
  const result = await runAction(generateWebsite, { projectId, brief });
  if (result.ok) refresh(projectId);
  return result;
}

export async function editWebsiteWithAIAction(projectId: string, instruction: string, expectedVersion: number) {
  const result = await runAction(editWebsiteWithAI, { projectId, instruction, expectedVersion });
  if (result.ok) refresh(projectId);
  return result;
}

export async function saveWebsiteAction(projectId: string, content: unknown, expectedVersion: number) {
  const result = await runAction(saveWebsite, { projectId, content, expectedVersion });
  if (result.ok) refresh(projectId);
  return result;
}
