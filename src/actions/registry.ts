import type { ActionDefinition } from "./define";
import { btsCancelOrder, btsDirectory, btsEstimate, btsSend, btsTrack, connectBts, getBtsSetup, saveBtsSettings, connectYandex, getYandexSetup, yandexCancel, yandexDispatch, yandexEstimate, yandexRefresh } from "./delivery";
import { getMetrics } from "./metrics";
import { assignOrderCourier, getCourierSetup, removeCourier } from "./couriers";
import { connectCrm, getCrmSetup } from "./crm";
import { getAiSettings, saveAiSettings } from "./ai-assistant";
import { getConversation, listConversations, sendChatReply } from "./chat";
import { connectEskiz, getEskizSetup, sendTestSms } from "./sms";
import { broadcastInfo, channelInfo, deletePromo, listPromos, postProductToChannel, postToChannel, savePromo, sendBroadcastChunk, sendBroadcastTest, setAutoPost, setPromoActive, unlinkPostChannel } from "./marketing";
import { addMember, changePassword, getSettings, removeMember, renameWorkspace, saveProfile, updateMemberRole } from "./settings";
import { getCardPaySetup, saveCardPaySettings, unlinkPayChannel } from "./card-pay";
import { connectBot, disconnectBot, getBot, saveBotConfig, updateBotRequestStatus } from "./bots";
import {
  connectBito,
  connectPayProvider,
  disconnectIntegration,
  getBitoSetup,
  getPaySetup,
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
  getCardPaySetup,
  saveCardPaySettings,
  unlinkPayChannel,
  getYandexSetup,
  connectYandex,
  yandexEstimate,
  yandexDispatch,
  yandexRefresh,
  yandexCancel,
  getBtsSetup,
  connectBts,
  saveBtsSettings,
  btsDirectory,
  btsEstimate,
  btsSend,
  btsTrack,
  btsCancelOrder,
  getSettings,
  renameWorkspace,
  saveProfile,
  changePassword,
  addMember,
  updateMemberRole,
  removeMember,
  getMetrics,
  listPromos,
  savePromo,
  setPromoActive,
  deletePromo,
  broadcastInfo,
  sendBroadcastTest,
  sendBroadcastChunk,
  channelInfo,
  setAutoPost,
  unlinkPostChannel,
  postProductToChannel,
  postToChannel,
  getEskizSetup,
  connectEskiz,
  sendTestSms,
  listConversations,
  getConversation,
  sendChatReply,
  getAiSettings,
  saveAiSettings,
  getCrmSetup,
  connectCrm,
  getCourierSetup,
  removeCourier,
  assignOrderCourier,
  disconnectIntegration,
  getPaySetup,
  connectPayProvider,
];

export function getAction(name: string) {
  return actionRegistry.find((a) => a.name === name);
}
