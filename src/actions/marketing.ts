import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { normalizeCode, type PromoRow } from "@/lib/shop/promo";
import { createAdminClient } from "@/lib/supabase/admin";
import { tg } from "@/lib/telegram/api";
import { PostError, postCustom, postProduct } from "@/lib/telegram/channel-post";
import { linkCode, loadMainBot, updateBotConfig } from "@/lib/telegram/main-bot";
import { ensureWorkspaceWebhooks } from "@/lib/telegram/webhook";
import { ActionError, defineAction } from "./define";
import { logAudit } from "./audit";

// ===== Promo-kodlar =====

export const listPromos = defineAction({
  name: "listPromos",
  description: "Promo-kodlar ro'yxati.",
  input: z.object({}),
  handler: async (ctx): Promise<{ ready: boolean; promos: PromoRow[] }> => {
    const { data, error } = await ctx.supabase
      .from("promo_codes")
      .select("id, code, kind, value, min_order, max_uses, used_count, active, expires_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false });
    // Jadval hali bazada bo'lmasa — sahifa "bazani yangilang" deydi
    if (error) return { ready: false, promos: [] };
    return { ready: true, promos: (data ?? []) as PromoRow[] };
  },
});

export const savePromo = defineAction({
  name: "savePromo",
  description: "Promo-kod yaratadi: foiz yoki qat'iy summa chegirma, minimal xarid, foydalanish limiti, muddat.",
  input: z.object({
    code: z.string().max(40),
    kind: z.enum(["percent", "fixed"]),
    value: z.number().int().positive(),
    minOrder: z.number().int().min(0).default(0),
    maxUses: z.number().int().positive().nullable().default(null),
    expiresAt: z.string().max(40).nullable().default(null),
  }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const code = normalizeCode(input.code);
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new ActionError("validation", "Kod 3–30 ta lotin harfi yoki raqamdan iborat bo'lsin");
    if (input.kind === "percent" && input.value > 100) throw new ActionError("validation", "Foiz 100 dan oshmasin");
    const db = createAdminClient();
    const { error } = await db.from("promo_codes").insert({
      workspace_id: ctx.workspaceId,
      code,
      kind: input.kind,
      value: input.value,
      min_order: input.minOrder,
      max_uses: input.maxUses,
      expires_at: input.expiresAt ? new Date(`${input.expiresAt}T23:59:59+05:00`).toISOString() : null,
    });
    if (error) throw new ActionError("validation", error.code === "23505" ? "Bunday kod allaqachon bor" : "Saqlanmadi. Baza yangilanganini tekshiring.");
    return { ok: true };
  },
});

export const setPromoActive = defineAction({
  name: "setPromoActive",
  description: "Promo-kodni yoqadi yoki o'chiradi.",
  input: z.object({ id: z.string().uuid(), active: z.boolean() }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await createAdminClient().from("promo_codes").update({ active: input.active }).eq("id", input.id).eq("workspace_id", ctx.workspaceId);
    return { ok: true };
  },
});

export const deletePromo = defineAction({
  name: "deletePromo",
  description: "Promo-kodni o'chiradi.",
  input: z.object({ id: z.string().uuid() }),
  minRole: "admin",
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    await createAdminClient().from("promo_codes").delete().eq("id", input.id).eq("workspace_id", ctx.workspaceId);
    return { ok: true };
  },
});

// ===== Ommaviy xabar (Telegram bot obunachilariga) =====

export type BroadcastBot = { projectId: string; username: string; subscribers: number; ownerLinked: boolean };

export const broadcastInfo = defineAction({
  name: "broadcastInfo",
  description: "Ommaviy xabar uchun botlar va obunachilar soni.",
  input: z.object({}),
  handler: async (ctx): Promise<BroadcastBot[]> => {
    const db = createAdminClient();
    const { data: bots } = await db.from("bots").select("project_id, username, owner_chat_id").eq("workspace_id", ctx.workspaceId).order("created_at");
    return Promise.all(
      (bots ?? []).map(async (b) => {
        const { count } = await db.from("bot_subscribers").select("chat_id", { count: "exact", head: true }).eq("project_id", b.project_id);
        return { projectId: b.project_id as string, username: b.username as string, subscribers: count ?? 0, ownerLinked: !!b.owner_chat_id };
      }),
    );
  },
});

const message = z.object({
  botProjectId: z.string().uuid(),
  text: z.string().trim().min(1, "Xabar matnini yozing").max(3500),
  buttonText: z.string().trim().max(40).default(""),
  buttonUrl: z.string().trim().max(500).default(""),
});

async function botToken(workspaceId: string, projectId: string) {
  const { data } = await createAdminClient().from("bots").select("token_encrypted, owner_chat_id").eq("project_id", projectId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new ActionError("not_found", "Bot topilmadi");
  return { token: decryptSecret(data.token_encrypted as string), ownerChatId: (data.owner_chat_id as number | null) ?? null };
}

function payload(input: z.infer<typeof message>, chatId: number, firstName: string | null) {
  const text = input.text.replace(/\{ism\}/gi, firstName || "do'stim");
  const url = /^https:\/\//.test(input.buttonUrl) ? input.buttonUrl : "";
  return {
    chat_id: chatId,
    text,
    ...(url && input.buttonText ? { reply_markup: { inline_keyboard: [[{ text: input.buttonText, url }]] } } : {}),
  };
}

export const sendBroadcastTest = defineAction({
  name: "sendBroadcastTest",
  description: "Ommaviy xabarni avval faqat bot egasiga (sizga) sinov uchun yuboradi.",
  input: message,
  minRole: "admin",
  handler: async (ctx, input) => {
    const { token, ownerChatId } = await botToken(ctx.workspaceId, input.botProjectId);
    if (!ownerChatId) throw new ActionError("validation", "Botga administrator sifatida ulanmagansiz (Telegram bot sahifasidagi havola orqali ulaning)");
    await tg(token, "sendMessage", payload(input, ownerChatId, "Siz"));
    return { ok: true };
  },
});

const CHUNK = 25;

export const sendBroadcastChunk = defineAction({
  name: "sendBroadcastChunk",
  description: "Bot obunachilariga ommaviy xabarni partiyalab yuboradi (har chaqiruvda 25 ta). Pulsiz, lekin qaytarib bo'lmaydi.",
  input: message.extend({ offset: z.number().int().min(0).default(0) }),
  minRole: "admin",
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    const { token } = await botToken(ctx.workspaceId, input.botProjectId);
    const db = createAdminClient();
    const [{ data: subs }, { count }] = await Promise.all([
      db.from("bot_subscribers").select("chat_id, first_name").eq("project_id", input.botProjectId).order("chat_id").range(input.offset, input.offset + CHUNK - 1),
      db.from("bot_subscribers").select("chat_id", { count: "exact", head: true }).eq("project_id", input.botProjectId),
    ]);
    let sent = 0;
    let failed = 0;
    for (const s of subs ?? []) {
      try {
        await tg(token, "sendMessage", payload(input, Number(s.chat_id), (s.first_name as string | null) ?? null));
        sent++;
      } catch {
        // mijoz botni bloklagan bo'lishi mumkin
        failed++;
      }
      // Telegram cheklovi: sekundiga ~30 xabar
      await new Promise((r) => setTimeout(r, 45));
    }
    const next = input.offset + (subs?.length ?? 0);
    if (input.offset === 0) await logAudit(ctx, "marketing.broadcast", { type: "project", id: input.botProjectId });
    return { sent, failed, total: count ?? 0, nextOffset: (subs?.length ?? 0) === CHUNK && next < (count ?? 0) ? next : null };
  },
});

// ===== Telegram kanalga post =====

export type ChannelInfo = { hasBot: boolean; botUsername: string | null; linked: boolean; title: string; code: string; autoPostNew: boolean };

export const channelInfo = defineAction({
  name: "channelInfo",
  description: "Mahsulot postlari uchun Telegram kanal holati va ulash kodi.",
  input: z.object({}),
  handler: async (ctx): Promise<ChannelInfo> => {
    const db = createAdminClient();
    const bot = await loadMainBot(db, ctx.workspaceId);
    if (!bot) return { hasBot: false, botUsername: null, linked: false, title: "", code: "", autoPostNew: false };
    // Kanal xabarlarini olish uchun webhook yangilanadi
    await ensureWorkspaceWebhooks(db, ctx.workspaceId);
    return {
      hasBot: true,
      botUsername: bot.username,
      linked: !!bot.config.postChannelId,
      title: bot.config.postChannelTitle,
      code: linkCode(bot.linkCode, "channel"),
      autoPostNew: bot.config.autoPostNew,
    };
  },
});

export const setAutoPost = defineAction({
  name: "setAutoPost",
  description: "Yangi qo'shilgan mahsulotni kanalga avtomatik chiqarishni yoqadi/o'chiradi.",
  input: z.object({ enabled: z.boolean() }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const db = createAdminClient();
    const bot = await loadMainBot(db, ctx.workspaceId);
    if (!bot) throw new ActionError("validation", "Avval Telegram botni ulang");
    await updateBotConfig(db, bot.projectId, { autoPostNew: input.enabled });
    return { ok: true };
  },
});

export const unlinkPostChannel = defineAction({
  name: "unlinkPostChannel",
  description: "Mahsulot postlari kanalini uzadi.",
  input: z.object({}),
  minRole: "admin",
  handler: async (ctx) => {
    const db = createAdminClient();
    const bot = await loadMainBot(db, ctx.workspaceId);
    if (bot) await updateBotConfig(db, bot.projectId, { postChannelId: null, postChannelTitle: "", autoPostNew: false });
    return { ok: true };
  },
});

async function wrapPost<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PostError) throw new ActionError("validation", err.message);
    throw err;
  }
}

export const postProductToChannel = defineAction({
  name: "postProductToChannel",
  description: "Mahsulotni rasm, narx va «Buyurtma berish» tugmasi bilan Telegram kanalga chiqaradi.",
  input: z.object({ productId: z.string().uuid() }),
  handler: async (ctx, input) => {
    await wrapPost(() => postProduct(createAdminClient(), ctx.workspaceId, input.productId));
    return { ok: true };
  },
});

export const postToChannel = defineAction({
  name: "postToChannel",
  description: "Kanalga ixtiyoriy aksiya/e'lon posti (matn, rasm havolasi, tugma).",
  input: z.object({
    text: z.string().trim().min(1).max(1000),
    imageUrl: z.string().trim().max(500).default(""),
    buttonText: z.string().trim().max(40).default(""),
    buttonUrl: z.string().trim().max(500).default(""),
  }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await wrapPost(() => postCustom(createAdminClient(), ctx.workspaceId, input));
    return { ok: true };
  },
});

// ===== Tashlab ketilgan savat =====

export type AbandonSettings = { hasBot: boolean; enabled: boolean; hours: number; text: string; waiting: number };

export const getAbandonSettings = defineAction({
  name: "getAbandonSettings",
  description: "Tashlab ketilgan savat eslatmasi sozlamalari va hozir kutilayotgan savatlar soni.",
  input: z.object({}),
  handler: async (ctx): Promise<AbandonSettings> => {
    const db = createAdminClient();
    const bot = await loadMainBot(db, ctx.workspaceId);
    if (!bot) return { hasBot: false, enabled: false, hours: 2, text: "", waiting: 0 };
    const { count } = await db.from("bot_subscribers").select("chat_id", { count: "exact", head: true }).eq("project_id", bot.projectId).not("state->cart", "is", null);
    return { hasBot: true, enabled: bot.config.abandonEnabled, hours: bot.config.abandonHours, text: bot.config.abandonText, waiting: count ?? 0 };
  },
});

export const saveAbandonSettings = defineAction({
  name: "saveAbandonSettings",
  description: "Tashlab ketilgan savat eslatmasini yoqadi: necha soatdan keyin va qo'shimcha matn (masalan promo-kod).",
  input: z.object({ enabled: z.boolean(), hours: z.number().int().min(1).max(48), text: z.string().max(500).default("") }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const db = createAdminClient();
    const bot = await loadMainBot(db, ctx.workspaceId);
    if (!bot) throw new ActionError("validation", "Avval Telegram botni ulang");
    await updateBotConfig(db, bot.projectId, { abandonEnabled: input.enabled, abandonHours: input.hours, abandonText: input.text.trim() });
    return { ok: true };
  },
});
