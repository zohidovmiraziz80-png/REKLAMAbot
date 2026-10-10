import { z } from "zod";
import { decryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { YandexError, checkPrice, yandexSettingsSchema, type YandexSettings } from "@/lib/delivery/yandex";
import { BTS_TEST_URL, BtsError, btsCancel, btsCreate, btsQuote, btsRefresh, btsSettingsSchema, cities, loadBtsAuth, regions, testLogin, type BtsSettings } from "@/lib/delivery/bts";
import { cancelYandex, dispatchYandex, estimateYandex, refreshYandex } from "@/lib/delivery/yandex-flow";
import { encryptCreds, keyHint } from "@/lib/integrations/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, defineAction } from "./define";
import { logAudit } from "./audit";
import { requireFeature } from "./plan-guard";

/** Yandex xatosini foydalanuvchiga tushunarli xabarga aylantiradi */
async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof YandexError) throw new ActionError("validation", err.message);
    throw err;
  }
}

export type YandexSetup = { connected: boolean; status: string | null; keyHint: string | null; settings: Partial<YandexSettings> | null; lastError: string | null };

export const getYandexSetup = defineAction({
  name: "getYandexSetup",
  description: "Yandex Delivery ulanish holati va olib ketish manzili sozlamalari.",
  input: z.object({}),
  handler: async (ctx): Promise<YandexSetup> => {
    const { data } = await ctx.supabase
      .from("integrations")
      .select("status, key_hint, settings, last_error")
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", "yandex")
      .maybeSingle();
    return {
      connected: !!data,
      status: (data?.status as string | undefined) ?? null,
      keyHint: (data?.key_hint as string | undefined) ?? null,
      settings: (data?.settings as Partial<YandexSettings> | undefined) ?? null,
      lastError: (data?.last_error as string | null | undefined) ?? null,
    };
  },
});

export const connectYandex = defineAction({
  name: "connectYandex",
  description: "Yandex Delivery'ni ulaydi: OAuth token (shifrlanadi) va olib ketish manzili. Ulashdan oldin token sinab ko'riladi.",
  input: z.object({ settings: z.record(z.unknown()), token: z.string().trim().max(500).default("") }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    if (!isEncryptionConfigured()) throw new ActionError("internal", "Server shifrlash kaliti sozlanmagan");
    const parsed = yandexSettingsSchema.safeParse(input.settings);
    if (!parsed.success) throw new ActionError("validation", parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri");
    const db = createAdminClient();
    const { data: existing } = await db
      .from("integrations")
      .select("credentials_encrypted, key_hint")
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", "yandex")
      .maybeSingle();
    if (!input.token && !existing) throw new ActionError("validation", "Tokenni kiriting");

    let token = input.token;
    if (!token && existing) {
      token = (JSON.parse(decryptSecret(existing.credentials_encrypted as string)) as { token: string }).token;
    }
    // Tokenni sinash: do'kondan ~1 km uzoqlikka narx so'raymiz
    await wrap(() =>
      checkPrice({ ...parsed.data, token }, { lat: parsed.data.pickupLat + 0.008, lon: parsed.data.pickupLon + 0.008, fullname: parsed.data.pickupAddress }),
    );

    const row: Record<string, unknown> = {
      workspace_id: ctx.workspaceId,
      provider: "yandex",
      status: "active",
      settings: parsed.data,
      last_error: null,
      created_by: ctx.user.id,
      credentials_encrypted: input.token ? encryptCreds({ token: input.token }) : existing!.credentials_encrypted,
      key_hint: input.token ? keyHint(input.token) : existing!.key_hint,
    };
    const { error } = await db.from("integrations").upsert(row, { onConflict: "workspace_id,provider" });
    if (error) throw new ActionError("internal", "Saqlanmadi");
    await logAudit(ctx, "integration.connect", { type: "integration", id: "yandex" });
    return { ok: true };
  },
});

const orderInput = z.object({ orderId: z.string().uuid() });

export const yandexEstimate = defineAction({
  name: "yandexEstimate",
  description: "Buyurtma uchun Yandex kuryer narxi va vaqtini hisoblaydi (kuryer chaqirilmaydi).",
  input: orderInput,
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    return wrap(() => estimateYandex(createAdminClient(), ctx.workspaceId, input.orderId));
  },
});

export const yandexDispatch = defineAction({
  name: "yandexDispatch",
  description: "Buyurtmaga Yandex kuryer chaqiradi (pullik xizmat).",
  input: orderInput,
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    const r = await wrap(() => dispatchYandex(createAdminClient(), ctx.workspaceId, input.orderId));
    await logAudit(ctx, "delivery.yandex.dispatch", { type: "order", id: input.orderId });
    return r;
  },
});

export const yandexRefresh = defineAction({
  name: "yandexRefresh",
  description: "Yandex kuryer holatini yangilaydi.",
  input: orderInput,
  handler: async (ctx, input) => wrap(() => refreshYandex(createAdminClient(), ctx.workspaceId, input.orderId)),
});

export const yandexCancel = defineAction({
  name: "yandexCancel",
  description: "Yandex kuryer chaqiruvini bekor qiladi (kuryer kelgandan keyin pullik bo'lishi mumkin).",
  input: orderInput,
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    const r = await wrap(() => cancelYandex(createAdminClient(), ctx.workspaceId, input.orderId));
    await logAudit(ctx, "delivery.yandex.cancel", { type: "order", id: input.orderId });
    return { message: r };
  },
});

// ===== BTS =====

export type BtsSetup = {
  connected: boolean;
  complete: boolean;
  keyHint: string | null;
  settings: Partial<BtsSettings> | null;
};

export const getBtsSetup = defineAction({
  name: "getBtsSetup",
  description: "BTS ulanish holati va jo'natuvchi sozlamalari.",
  input: z.object({}),
  handler: async (ctx): Promise<BtsSetup> => {
    const { data } = await ctx.supabase.from("integrations").select("status, key_hint, settings").eq("workspace_id", ctx.workspaceId).eq("provider", "bts").maybeSingle();
    const settings = (data?.settings as Partial<BtsSettings> | undefined) ?? null;
    return {
      connected: !!data,
      complete: !!data && data.status === "active" && btsSettingsSchema.safeParse(settings).success,
      keyHint: (data?.key_hint as string | undefined) ?? null,
      settings,
    };
  },
});

async function wrapBts<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof BtsError) throw new ActionError("validation", err.message);
    throw err;
  }
}

export const connectBts = defineAction({
  name: "connectBts",
  description: "BTS login va parolini (shifrlanadi) hamda server manzilini saqlaydi; kirib ko'rib tekshiradi.",
  input: z.object({ baseUrl: z.string().trim().max(200), login: z.string().trim().max(100).default(""), password: z.string().max(200).default("") }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    if (!isEncryptionConfigured()) throw new ActionError("internal", "Server shifrlash kaliti sozlanmagan");
    const base = btsSettingsSchema.shape.baseUrl.safeParse(input.baseUrl || BTS_TEST_URL);
    if (!base.success) throw new ActionError("validation", base.error.issues[0]?.message ?? "Server manzili noto'g'ri");
    const db = createAdminClient();
    const { data: existing } = await db.from("integrations").select("credentials_encrypted, key_hint, settings").eq("workspace_id", ctx.workspaceId).eq("provider", "bts").maybeSingle();
    let login = input.login;
    let password = input.password;
    if ((!login || !password) && existing) {
      const c = JSON.parse(decryptSecret(existing.credentials_encrypted as string)) as { login: string; password: string };
      login ||= c.login;
      password ||= c.password;
    }
    if (!login || !password) throw new ActionError("validation", "BTS login va parolini kiriting");
    await wrapBts(() => testLogin({ baseUrl: base.data, login, password }));
    const settings = { ...((existing?.settings as Record<string, unknown> | null) ?? {}), baseUrl: base.data };
    const complete = btsSettingsSchema.safeParse(settings).success;
    const { error } = await db.from("integrations").upsert(
      {
        workspace_id: ctx.workspaceId,
        provider: "bts",
        status: complete ? "active" : "error",
        settings,
        last_error: complete ? null : "Jo'natuvchi ma'lumotlari to'ldirilmagan",
        created_by: ctx.user.id,
        credentials_encrypted: encryptCreds({ login, password }),
        key_hint: keyHint(login),
      },
      { onConflict: "workspace_id,provider" },
    );
    if (error) throw new ActionError("internal", "Saqlanmadi");
    await logAudit(ctx, "integration.connect", { type: "integration", id: "bts" });
    return { ok: true };
  },
});

export const saveBtsSettings = defineAction({
  name: "saveBtsSettings",
  description: "BTS jo'natuvchi ma'lumotlari: ism, telefon, manzil, shahar kodi, olib ketish usuli, standart og'irlik.",
  input: z.object({ settings: z.record(z.unknown()) }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    const db = createAdminClient();
    const { data: existing } = await db.from("integrations").select("settings").eq("workspace_id", ctx.workspaceId).eq("provider", "bts").maybeSingle();
    if (!existing) throw new ActionError("validation", "Avval BTS login va parolini saqlang");
    const parsed = btsSettingsSchema.safeParse({ ...input.settings, baseUrl: (existing.settings as { baseUrl?: string } | null)?.baseUrl ?? BTS_TEST_URL });
    if (!parsed.success) throw new ActionError("validation", parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri");
    await db.from("integrations").update({ settings: parsed.data, status: "active", last_error: null }).eq("workspace_id", ctx.workspaceId).eq("provider", "bts");
    return { ok: true };
  },
});

export const btsDirectory = defineAction({
  name: "btsDirectory",
  description: "BTS viloyatlar yoki (regionCode berilsa) shahar/tumanlar ro'yxati.",
  input: z.object({ regionCode: z.string().max(10).optional() }),
  handler: async (ctx, input) => {
    const auth = await loadBtsAuth(createAdminClient(), ctx.workspaceId);
    if (!auth) throw new ActionError("validation", "Avval BTS login va parolini saqlang");
    return wrapBts(async () => (input.regionCode ? await cities(auth, input.regionCode) : await regions(auth)));
  },
});

const btsOrder = z.object({ orderId: z.string().uuid() });

export const btsEstimate = defineAction({
  name: "btsEstimate",
  description: "BTS orqali yuborish narxi (kuryergacha va filialgacha).",
  input: z.object({ receiverCityCode: z.string().min(1).max(10), weight: z.number().min(0.1).max(100).optional() }),
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    return wrapBts(() => btsQuote(createAdminClient(), ctx.workspaceId, input.receiverCityCode, input.weight));
  },
});

export const btsSend = defineAction({
  name: "btsSend",
  description: "Buyurtmani BTS'ga jo'natish uchun yaratadi (pullik xizmat). Trek raqami mijozga yuboriladi.",
  input: btsOrder.extend({
    receiverCityCode: z.string().min(1).max(10),
    dropoff: z.enum(["courier", "branch"]),
    weight: z.number().min(0.1).max(100).optional(),
    cod: z.boolean().default(false),
  }),
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    const r = await wrapBts(() => btsCreate(createAdminClient(), ctx.workspaceId, input.orderId, input));
    await logAudit(ctx, "delivery.bts.create", { type: "order", id: input.orderId });
    return r;
  },
});

export const btsTrack = defineAction({
  name: "btsTrack",
  description: "BTS jo'natma holatini yangilaydi.",
  input: btsOrder,
  handler: async (ctx, input) => wrapBts(() => btsRefresh(createAdminClient(), ctx.workspaceId, input.orderId)),
});

export const btsCancelOrder = defineAction({
  name: "btsCancelOrder",
  description: "BTS jo'natmasini bekor qiladi (faqat kuryer olib ketmasdan oldin).",
  input: btsOrder,
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    await wrapBts(() => btsCancel(createAdminClient(), ctx.workspaceId, input.orderId));
    return { ok: true };
  },
});
