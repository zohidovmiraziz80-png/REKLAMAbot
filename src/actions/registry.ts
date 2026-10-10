import type { ActionDefinition } from "./define";
import { connectBot, disconnectBot, getBot, saveBotConfig, updateBotRequestStatus } from "./bots";
import {
  connectBito,
  disconnectIntegration,
  getBitoSetup,
  listIntegrations,
  retryOrderSync,
  saveBitoSettings,
  syncBitoNow,
} from "./integrations";
import { getMyPlan } from "./plans";
import { createProject, deleteProject, listProjects, renameProject } from "./projects";
import {
  addCustomDomain,
  checkCustomDomain,
  getPublishStatus,
  publishWebsite,
  removeCustomDomain,
  unpublishWebsite,
} from "./publishing";
import {
  deleteProduct,
  getShopSettings,
  listCustomers,
  listOrders,
  listProducts,
  saveProduct,
  saveShopSettings,
  setProductActive,
  updateCustomer,
  updateOrder,
} from "./shop";
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
  getPublishStatus,
  publishWebsite,
  unpublishWebsite,
  addCustomDomain,
  checkCustomDomain,
  removeCustomDomain,
  getBot,
  connectBot,
  saveBotConfig,
  disconnectBot,
  updateBotRequestStatus,
  getMyPlan,
  listProducts,
  saveProduct,
  setProductActive,
  deleteProduct,
  listOrders,
  updateOrder,
  listCustomers,
  updateCustomer,
  getShopSettings,
  saveShopSettings,
  listIntegrations,
  connectBito,
  getBitoSetup,
  saveBitoSettings,
  syncBitoNow,
  retryOrderSync,
  disconnectIntegration,
];

export function getAction(name: string) {
  return actionRegistry.find((a) => a.name === name);
}
