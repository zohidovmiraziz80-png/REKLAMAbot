import type { ActionDefinition } from "./define";
import { createProject, deleteProject, listProjects, renameProject } from "./projects";
import { createWebsiteFromTemplate, editWebsiteWithAI, generateWebsite, getWebsite, saveWebsite } from "./websites";

/**
 * Barcha amallar reyestri. Yangi amal yozilganda shu ro'yxatga qo'shiladi.
 * AI Assistant (7-bosqich) tool ro'yxatini shu yerdan avtomatik oladi.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const actionRegistry: ActionDefinition<any, any>[] = [
  createProject,
  listProjects,
  renameProject,
  deleteProject,
  getWebsite,
  createWebsiteFromTemplate,
  generateWebsite,
  editWebsiteWithAI,
  saveWebsite,
];

export function getAction(name: string) {
  return actionRegistry.find((a) => a.name === name);
}
