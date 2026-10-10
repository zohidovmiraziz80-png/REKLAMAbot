import type { SupabaseClient } from "@supabase/supabase-js";
import { tg } from "@/lib/telegram/api";

/**
 * Mijoz ↔ do'kon yozishmasi (Telegram bot orqali).
 * Kirgan xabar saqlanadi va egasiga yuboriladi; ega o'sha xabarga reply qilsa yoki MIXBOT'dan yozsa — mijozga boradi.
 */

type Bot = { project_id: string; workspace_id: string; owner_chat_id: number | null; token: string };

/** Mijoz xabarini saqlaydi va egaga yuboradi. Jadval hali bo'lmasa false qaytaradi. */
export async function logIncoming(db: SupabaseClient, bot: Bot, chatId: number, who: string, text: string): Promise<boolean> {
  const { data, error } = await db
    .from("chat_messages")
    .insert({ workspace_id: bot.workspace_id, project_id: bot.project_id, chat_id: chatId, direction: "in", text: text.slice(0, 4096) })
    .select("id")
    .single();
  if (error || !data) return false;
  if (bot.owner_chat_id && bot.owner_chat_id !== chatId) {
    try {
      const sent = await tg<{ message_id: number }>(bot.token, "sendMessage", {
        chat_id: bot.owner_chat_id,
        text: `💬 ${who}:\n${text.slice(0, 3500)}\n\n↩️ Javob berish uchun shu xabarga «Reply» qiling.`,
      });
      await db.from("chat_messages").update({ owner_message_id: sent.message_id }).eq("id", data.id);
    } catch {
      // egaga yetmasa ham xabar MIXBOT'da saqlangan
    }
  }
  return true;
}

/** Ega Telegram'da mijoz xabariga reply qildi — javobni mijozga yuboradi */
export async function handleOwnerReply(db: SupabaseClient, bot: Bot, replyToId: number, text: string): Promise<"sent" | "notfound" | "failed"> {
  const { data: orig } = await db
    .from("chat_messages")
    .select("chat_id")
    .eq("project_id", bot.project_id)
    .eq("owner_message_id", replyToId)
    .maybeSingle();
  if (!orig) return "notfound";
  return (await sendToCustomer(db, bot, Number(orig.chat_id), text, null)) ? "sent" : "failed";
}

export async function sendToCustomer(db: SupabaseClient, bot: Bot, chatId: number, text: string, userId: string | null) {
  try {
    await tg(bot.token, "sendMessage", { chat_id: chatId, text: text.slice(0, 4096) });
  } catch {
    return false;
  }
  await db.from("chat_messages").insert({
    workspace_id: bot.workspace_id,
    project_id: bot.project_id,
    chat_id: chatId,
    direction: "out",
    text: text.slice(0, 4096),
    sender_user_id: userId,
    read_at: new Date().toISOString(),
  });
  // Javob berilgan suhbatdagi kirgan xabarlar o'qilgan bo'ladi
  await db.from("chat_messages").update({ read_at: new Date().toISOString() }).eq("project_id", bot.project_id).eq("chat_id", chatId).is("read_at", null);
  return true;
}
