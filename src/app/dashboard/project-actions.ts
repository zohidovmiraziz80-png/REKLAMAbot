"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { createProject, deleteProject, renameProject } from "@/actions/projects";
import type { ActionResult } from "@/actions/define";

// Interfeys tugmalari shu Server Action'lar orqali amallar qatlamini chaqiradi.

export async function createProjectAction(input: { name: string; type: string }) {
  const result = await runAction(createProject, input);
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

export async function renameProjectAction(input: { id: string; name: string }) {
  const result = await runAction(renameProject, input);
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

export async function deleteProjectAction(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  // Foydalanuvchi interfeysda tasdiqlash oynasini bosgandan keyingina chaqiriladi
  const result = await runAction(deleteProject, input, { confirmed: true });
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}
