"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import {
  addCustomDomain,
  checkCustomDomain,
  getPublishStatus,
  publishWebsite,
  removeCustomDomain,
  unpublishWebsite,
} from "@/actions/publishing";
import { createWebsiteFromTemplate, editWebsiteWithAI, generateWebsite, saveWebsite } from "@/actions/websites";

// Tahrirlovchi tugmalari amallar qatlamini shu Server Action'lar orqali chaqiradi.

function refresh(projectId: string) {
  revalidatePath(`/dashboard/sites/${projectId}`);
  revalidatePath(`/preview/${projectId}`, "layout");
}

function refreshPublic(projectId: string, slug?: string | null) {
  refresh(projectId);
  if (slug) revalidatePath(`/s/${slug}`, "layout");
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

export async function createFromTemplateAction(projectId: string, templateId: string, details: Record<string, string>) {
  const result = await runAction(createWebsiteFromTemplate, { projectId, templateId, details });
  if (result.ok) refresh(projectId);
  return result;
}

// ===== Nashr va domenlar (tugmalar foydalanuvchi tasdig'idan keyin chaqiriladi) =====

export async function getPublishStatusAction(projectId: string) {
  return runAction(getPublishStatus, { projectId });
}

export async function publishWebsiteAction(projectId: string, slug: string) {
  const result = await runAction(publishWebsite, { projectId, slug }, { confirmed: true });
  if (result.ok) refreshPublic(projectId, result.data.slug);
  return result;
}

export async function unpublishWebsiteAction(projectId: string, slug: string | null) {
  const result = await runAction(unpublishWebsite, { projectId }, { confirmed: true });
  if (result.ok) refreshPublic(projectId, slug);
  return result;
}

export async function addCustomDomainAction(projectId: string, domain: string) {
  const result = await runAction(addCustomDomain, { projectId, domain }, { confirmed: true });
  if (result.ok) refresh(projectId);
  return result;
}

export async function checkCustomDomainAction(projectId: string, domain: string) {
  return runAction(checkCustomDomain, { projectId, domain });
}

export async function removeCustomDomainAction(projectId: string, domain: string) {
  const result = await runAction(removeCustomDomain, { projectId, domain }, { confirmed: true });
  if (result.ok) refresh(projectId);
  return result;
}
