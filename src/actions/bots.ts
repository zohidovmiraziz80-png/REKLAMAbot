import { z } from "zod";
import { decryptSecret, encryptSecret, isEncryptionConfigured, randomToken } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/supabase/env";
import { BOT_TOKEN_RE, TelegramError, tg, type TgBotInfo } from "@/lib/telegram/api";
import { botConfigSchema, defaultBotConfig, safeWebAppUrl, type BotConfig } from "@/lib/telegram/config";
import { publicSiteUrls } from "@/lib/site/hosting";
import { ActionError, defineAction, type ActionContext } from "./define";
import { logAudit } from "./audit";
import { requireFeature } from "./plan-guard";

/** Vercel'ning barcha domenlariga xizmat qiluvchi doimiy IP (Vercel hujjatlaridagi A yozuvi) */
const VERCEL_EDGE_IP = "76.76.21.21";

export const REQUEST_STATUSES =["new", "in_progress", "done", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type BotRequest = {
  id: number;
  customer_name: string | null;
  username: string | null;
  phone: string | null;
  message: string;
  status: RequestStatus;
  created_at: string;
};

export type BotInfo = {
  projectId: string;
  projectName: string;
  connected: boolean;
  username: string | null;
  ownerLinked: boolean;
  ownerLink: string | null;
  config: BotConfig;
  status: "active" | "error" | null;
  lastError: string | null;
  subscribers: number;
  requests: BotRequest[];
  encryptionReady: boolean;
  /** Workspace'dagi nashr qilingan saytlar — Mini App uchun tanlash */
  sites: { name: string; url: string }[];
};

async function publishedSites(ctx: ActionContext) {
  const { data: pubs } = await ctx.supabase.from("published_sites").select("project_id, slug").eq("workspace_id", ctx.workspaceId);
  if (!pubs?.length) return [];
  const { data: projects } = await ctx.supabase
    .from("projects")
    .select("id, name")
    .in("id", pubs.map((p) => p.project_id as string));
  const names = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));
  return pubs.map((p) => {
    const urls = publicSiteUrls(p.slug as string);
    return { name: names.get(p.project_id as string) ?? (p.slug as string), url: urls.subdomainUrl ?? urls.pathUrl };
  });
}

/** Xabar maydoni yonidagi menyu tugmasini Mini App'ga yoki oddiy buyruqlar menyusiga o'rnatadi */
/** Bot qabul qiladigan Telegram yangilanishlari (callback_query — buyurtma tugmalari uchun) */
const ALLOWED_UPDATES = ["message", "callback_query"];

/** Avval faqat "message" bilan ulangan botlarning webhook'ini yangilaydi (manzil va kalit o'zgarmaydi) */
async function ensureWebhookUpdates(token: string, projectId: string, secret: string) {
  const info = await tg<{ url?: string; allowed_updates?: string[]; ip_address?: string }>(token, "getWebhookInfo");
  if (!info.url || ALLOWED_UPDATES.every((u) => info.allowed_updates?.includes(u))) return;
  await tg(token, "setWebhook", {
    url: `${getSiteUrl()}/api/telegram/${projectId}`,
    secret_token: secret,
    allowed_updates: ALLOWED_UPDATES,
    max_connections: 20,
    ...(info.ip_address ? { ip_address: info.ip_address } : {}),
  });
}

async function syncMenuButton(token: string, config: BotConfig) {
  const url = safeWebAppUrl(config.siteUrl);
  await tg(token, "setChatMenuButton", {
    menu_button: url ? { type: "web_app", text: config.menuButtonText || "Do'kon", web_app: { url } } : { type: "commands" },
  });
}

async function loadBotProject(ctx: ActionContext, projectId: string) {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id, name, type")
    .eq("id", projectId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) throw new ActionError("internal", "Loyiha yuklanmadi");
  if (!data) throw new ActionError("not_found", "Loyiha topilmadi");
  if (data.type !== "bot") throw new ActionError("validation", "Bu loyiha Telegram bot emas");
  return data as { id: string; name: string };
}

function telegramError(err: unknown): never {
  if (err instanceof TelegramError) {
    if (err.status === 401 || err.status === 404) {
      throw new ActionError("validation", "Token noto'g'ri yoki bekor qilingan. BotFather'dan yangi token oling.");
    }
    throw new ActionError("internal", `Telegram xatosi: ${err.message}`);
  }
  throw err;
}

function admin() {
  try {
    return createAdminClient();
  } catch {
    throw new ActionError("internal", "Server sozlanmagan (service key). Administratorga murojaat qiling.");
  }
}

// ===== O'qish =====

export const getBot = defineAction({
  name: "getBot",
  description: "Telegram bot loyihasining holati, menyusi, obunachilar soni va oxirgi arizalarini qaytaradi",
  input: z.object({ projectId: z.string().uuid() }),
  handler: async (ctx, input): Promise<BotInfo> => {
    const project = await loadBotProject(ctx, input.projectId);
    const { data: bot } = await ctx.supabase
      .from("bots")
      .select("username, owner_link_code, owner_chat_id, config, status, last_error")
      .eq("project_id", project.id)
      .maybeSingle();

    const [{ count }, { data: requests }, sites] = await Promise.all([
      ctx.supabase.from("bot_subscribers").select("id", { count: "exact", head: true }).eq("project_id", project.id),
      ctx.supabase
        .from("bot_requests")
        .select("id, customer_name, username, phone, message, status, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(50),
      publishedSites(ctx),
    ]);

    return {
      projectId: project.id,
      projectName: project.name,
      connected: !!bot,
      username: (bot?.username as string | undefined) ?? null,
      ownerLinked: !!bot?.owner_chat_id,
      ownerLink: bot ? `https://t.me/${bot.username}?start=owner_${bot.owner_link_code}` : null,
      config: bot ? botConfigSchema.parse(bot.config ?? {}) : defaultBotConfig(project.name, sites[0]?.url ?? ""),
      status: (bot?.status as BotInfo["status"]) ?? null,
      lastError: (bot?.last_error as string | null | undefined) ?? null,
      subscribers: count ?? 0,
      requests: (requests ?? []) as BotRequest[],
      encryptionReady: isEncryptionConfigured(),
      sites,
    };
  },
});

// ===== Ulash =====

export const connectBot = defineAction({
  name: "connectBot",
  description: "BotFather'dan olingan token orqali Telegram botni loyihaga ulaydi va webhook o'rnatadi",
  input: z.object({ projectId: z.string().uuid(), token: z.string().trim().max(100) }),
  handler: async (ctx, input): Promise<{ username: string }> => {
    const project = await loadBotProject(ctx, input.projectId);
    await requireFeature(ctx, "bots");
    if (!BOT_TOKEN_RE.test(input.token)) {
      throw new ActionError("validation", "Token formati noto'g'ri. U 123456789:ABC... ko'rinishida bo'ladi.");
    }
    if (!isEncryptionConfigured()) {
      throw new ActionError("internal", "Server shifrlash kaliti sozlanmagan. Administratorga murojaat qiling.");
    }

    let me: TgBotInfo;
    try {
      me = await tg<TgBotInfo>(input.token, "getMe");
    } catch (err) {
      telegramError(err);
    }
    if (!me.is_bot || !me.username) throw new ActionError("validation", "Bu token botga tegishli emas");

    const db = admin();
    const { data: other } = await db
      .from("bots")
      .select("project_id")
      .eq("telegram_bot_id", me.id)
      .neq("project_id", project.id)
      .maybeSingle();
    if (other) throw new ActionError("validation", "Bu bot boshqa loyihaga ulangan. Avval u yerdan uzing.");

    const { data: existing } = await db
      .from("bots")
      .select("owner_link_code, config")
      .eq("project_id", project.id)
      .maybeSingle();

    const webhookSecret = randomToken(32);
    const webhook = {
      url: `${getSiteUrl()}/api/telegram/${project.id}`,
      secret_token: webhookSecret,
      allowed_updates: ALLOWED_UPDATES,
      drop_pending_updates: true,
      max_connections: 20,
    };
    try {
      await tg(input.token, "setWebhook", webhook);
    } catch (err) {
      // Telegram serverlari ba'zan *.vercel.app manzilini DNS orqali topa olmaydi —
      // bunday holatda Vercel'ning doimiy IP manzilini to'g'ridan-to'g'ri beramiz.
      const dnsIssue = err instanceof TelegramError && /resolve host|bad webhook/i.test(err.message);
      if (!dnsIssue) telegramError(err);
      // Telegram setWebhook'ni soniyasiga 1 martadan ko'p qabul qilmaydi
      await new Promise((r) => setTimeout(r, 1500));
      try {
        await tg(input.token, "setWebhook", { ...webhook, ip_address: VERCEL_EDGE_IP });
      } catch (err2) {
        telegramError(err2);
      }
    }
    try {
      await tg(input.token, "setMyCommands", { commands: [{ command: "start", description: "Bosh menyu" }] });
    } catch {
      // ixtiyoriy
    }

    const sites = await publishedSites(ctx);
    const config = existing ? botConfigSchema.parse(existing.config ?? {}) : defaultBotConfig(project.name, sites[0]?.url ?? "");
    try {
      await syncMenuButton(input.token, config);
    } catch {
      // ixtiyoriy
    }

    const row = {
      telegram_bot_id: me.id,
      username: me.username,
      token_encrypted: encryptSecret(input.token),
      webhook_secret: webhookSecret,
      status: "active",
      last_error: null,
    };

    const { error } = existing
      ? await db.from("bots").update(row).eq("project_id", project.id)
      : await db.from("bots").insert({
          ...row,
          project_id: project.id,
          workspace_id: ctx.workspaceId,
          owner_link_code: randomToken(8),
          config,
          created_by: ctx.user.id,
        });
    if (error) throw new ActionError("internal", "Bot saqlanmadi");

    await logAudit(ctx, "bot.connect", { type: "project", id: project.id }, { username: me.username });
    return { username: me.username };
  },
});

// ===== Sozlamalar =====

export const saveBotConfig = defineAction({
  name: "saveBotConfig",
  description: "Bot menyusi, salomlashish matni va ariza matnlarini saqlaydi",
  input: z.object({ projectId: z.string().uuid(), config: z.unknown() }),
  handler: async (ctx, input): Promise<{ config: BotConfig; menuButtonSynced: boolean }> => {
    const project = await loadBotProject(ctx, input.projectId);
    const config = botConfigSchema.parse(input.config ?? {});
    if (config.siteUrl && !safeWebAppUrl(config.siteUrl)) {
      throw new ActionError("validation", "Mini App manzili https:// bilan boshlanishi kerak");
    }
    const db = admin();
    const { data, error } = await db
      .from("bots")
      .update({ config })
      .eq("project_id", project.id)
      .select("token_encrypted, webhook_secret")
      .maybeSingle();
    if (error) throw new ActionError("internal", "Sozlamalar saqlanmadi");
    if (!data) throw new ActionError("not_found", "Avval botni ulang");

    let menuButtonSynced = true;
    const token = decryptSecret(data.token_encrypted as string);
    try {
      await syncMenuButton(token, config);
    } catch {
      menuButtonSynced = false;
    }
    try {
      await ensureWebhookUpdates(token, project.id, data.webhook_secret as string);
    } catch {
      // keyingi saqlashda qayta urinadi
    }
    await logAudit(ctx, "bot.config", { type: "project", id: project.id });
    return { config, menuButtonSynced };
  },
});

// ===== Uzish =====

export const disconnectBot = defineAction({
  name: "disconnectBot",
  description: "Telegram botni loyihadan uzadi (bot javob berishni to'xtatadi). Arizalar saqlanib qoladi",
  requiresConfirmation: true,
  minRole: "admin",
  input: z.object({ projectId: z.string().uuid() }),
  handler: async (ctx, input): Promise<{ ok: true }> => {
    const project = await loadBotProject(ctx, input.projectId);
    const db = admin();
    const { data: bot } = await db.from("bots").select("token_encrypted, username").eq("project_id", project.id).maybeSingle();
    if (!bot) return { ok: true };
    try {
      await tg(decryptSecret(bot.token_encrypted as string), "deleteWebhook", { drop_pending_updates: true });
    } catch {
      // token bekor qilingan bo'lishi mumkin — baribir uzamiz
    }
    const { error } = await db.from("bots").delete().eq("project_id", project.id);
    if (error) throw new ActionError("internal", "Bot uzilmadi");
    await logAudit(ctx, "bot.disconnect", { type: "project", id: project.id }, { username: bot.username });
    return { ok: true };
  },
});

// ===== Arizalar =====

export const updateBotRequestStatus = defineAction({
  name: "updateBotRequestStatus",
  description: "Bot orqali kelgan ariza holatini o'zgartiradi: new, in_progress, done, cancelled",
  input: z.object({
    projectId: z.string().uuid(),
    requestId: z.number().int().positive(),
    status: z.enum(REQUEST_STATUSES),
  }),
  handler: async (ctx, input): Promise<{ id: number; status: RequestStatus }> => {
    const project = await loadBotProject(ctx, input.projectId);
    const { data, error } = await ctx.supabase
      .from("bot_requests")
      .update({ status: input.status })
      .eq("id", input.requestId)
      .eq("project_id", project.id)
      .select("id, status")
      .maybeSingle();
    if (error) throw new ActionError("internal", "Holat o'zgarmadi");
    if (!data) throw new ActionError("not_found", "Ariza topilmadi");
    return data as { id: number; status: RequestStatus };
  },
});
