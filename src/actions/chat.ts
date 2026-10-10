import { z } from "zod";
import { sendToCustomer } from "@/lib/chat";
import { decryptSecret } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, defineAction } from "./define";

export type Conversation = {
  key: string;
  projectId: string;
  chatId: number;
  name: string;
  username: string | null;
  botUsername: string;
  lastText: string;
  lastAt: string;
  lastDirection: "in" | "out";
  unread: number;
};
export type ChatMessage = { id: number; direction: "in" | "out"; text: string; created_at: string };

export const listConversations = defineAction({
  name: "listConversations",
  description: "Telegram bot orqali yozgan mijozlar bilan suhbatlar ro'yxati (oxirgi xabar va o'qilmaganlar soni).",
  input: z.object({}),
  handler: async (ctx): Promise<{ ready: boolean; conversations: Conversation[] }> => {
    const { data, error } = await ctx.supabase
      .from("chat_messages")
      .select("project_id, chat_id, direction, text, created_at, read_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) return { ready: false, conversations: [] };
    const map = new Map<string, Conversation>();
    for (const m of data ?? []) {
      const key = `${m.project_id}:${m.chat_id}`;
      let c = map.get(key);
      if (!c) {
        c = {
          key,
          projectId: m.project_id as string,
          chatId: Number(m.chat_id),
          name: "",
          username: null,
          botUsername: "",
          lastText: m.text as string,
          lastAt: m.created_at as string,
          lastDirection: m.direction as "in" | "out",
          unread: 0,
        };
        map.set(key, c);
      }
      if (m.direction === "in" && !m.read_at) c.unread++;
    }
    const list = [...map.values()].slice(0, 200);
    if (list.length) {
      const db = createAdminClient();
      const [{ data: subs }, { data: bots }] = await Promise.all([
        db
          .from("bot_subscribers")
          .select("project_id, chat_id, first_name, username")
          .eq("workspace_id", ctx.workspaceId)
          .in("chat_id", list.map((c) => c.chatId)),
        db.from("bots").select("project_id, username").eq("workspace_id", ctx.workspaceId),
      ]);
      const sub = new Map((subs ?? []).map((s) => [`${s.project_id}:${s.chat_id}`, s]));
      const botName = new Map((bots ?? []).map((b) => [b.project_id as string, b.username as string]));
      for (const c of list) {
        const s = sub.get(c.key);
        c.name = (s?.first_name as string | null) || "Mijoz";
        c.username = (s?.username as string | null) ?? null;
        c.botUsername = botName.get(c.projectId) ?? "";
      }
    }
    return { ready: true, conversations: list };
  },
});

const conv = z.object({ projectId: z.string().uuid(), chatId: z.number().int() });

export const getConversation = defineAction({
  name: "getConversation",
  description: "Bitta mijoz bilan yozishma (oxirgi 200 xabar) va ularni o'qilgan deb belgilaydi.",
  input: conv,
  handler: async (ctx, input): Promise<ChatMessage[]> => {
    const db = createAdminClient();
    const { data } = await db
      .from("chat_messages")
      .select("id, direction, text, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("project_id", input.projectId)
      .eq("chat_id", input.chatId)
      .order("created_at", { ascending: false })
      .limit(200);
    await db
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("workspace_id", ctx.workspaceId)
      .eq("project_id", input.projectId)
      .eq("chat_id", input.chatId)
      .is("read_at", null);
    return ((data ?? []) as ChatMessage[]).reverse();
  },
});

export const sendChatReply = defineAction({
  name: "sendChatReply",
  description: "Mijozga Telegram bot orqali javob yozadi.",
  input: conv.extend({ text: z.string().trim().min(1).max(4000) }),
  handler: async (ctx, input) => {
    const db = createAdminClient();
    const { data: bot } = await db.from("bots").select("project_id, workspace_id, owner_chat_id, token_encrypted").eq("project_id", input.projectId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!bot) throw new ActionError("not_found", "Bot topilmadi");
    const ok = await sendToCustomer(
      db,
      { project_id: bot.project_id as string, workspace_id: bot.workspace_id as string, owner_chat_id: (bot.owner_chat_id as number | null) ?? null, token: decryptSecret(bot.token_encrypted as string) },
      input.chatId,
      input.text,
      ctx.user.id,
    );
    if (!ok) throw new ActionError("validation", "Yuborilmadi — mijoz botni bloklagan bo'lishi mumkin");
    return { ok: true };
  },
});
