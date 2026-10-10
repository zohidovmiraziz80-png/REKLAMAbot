"use server";

import { runAction } from "@/actions/run";
import { getConversation, listConversations, sendChatReply } from "@/actions/chat";

export async function listConversationsAction() {
  return runAction(listConversations, {});
}

export async function getConversationAction(projectId: string, chatId: number) {
  return runAction(getConversation, { projectId, chatId });
}

export async function sendChatReplyAction(projectId: string, chatId: number, text: string) {
  return runAction(sendChatReply, { projectId, chatId, text });
}
