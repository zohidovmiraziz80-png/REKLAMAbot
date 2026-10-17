import { z } from "zod";
import { decryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { NoorError, noorCancel, noorCreate, noorEstimate, noorRefresh, noorSettingsSchema, testNoor, type NoorSettings } from "@/lib/delivery/noor";
import {
  FargoError,
  fargoCancel,
  fargoCities,
  fargoCreate,
  fargoDistricts,
  fargoQuote,
  fargoRefresh,
  fargoSettingsSchema,
  loadFargoAuth,
  testFargo,
  type FargoCreds,
  type FargoSettings,
} from "@/lib/delivery/fargo";
import { encryptCreds, keyHint } from "@/lib/integrations/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, defineAction } from "./define";
import { logAudit } from "./audit";
import { requireFeature } from "./plan-guard";

/** Yetkazish xizmati xatosini foydalanuvchiga tushunarli xabarga aylantiradi */
async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof NoorError || err instanceof FargoError) throw new ActionError("validation", err.message);
    throw err;
  }
}

const orderInput = z.object({ orderId: z.string().uuid() });

// ===== Noor (shahar ichida tezkor yetkazish) =====

export type NoorSetup = { connected: boolean; complete: boolean; keyHint: string | null; settings: Partial<NoorSettings> | null };

export const getNoorSetup = defineAction({
  name: "getNoorSetup",
  description: "Noor yetkazish xizmati ulanish holati va olib ketish manzili.",
  input: z.object({}),
  handler: async (ctx): Promise<NoorSetup> => {
    const { data } = await ctx.supabase.from("integrations").select("status, key_hint, settings").eq("workspace_id", ctx.workspaceId).eq("provider", "noor").maybeSingle();
    const settings = (data?.settings as Partial<NoorSettings> | undefined) ?? null;
    return {
      connected: !!data,
      complete: !!data && data.status === "active" && noorSettingsSchema.safeParse(settings).success,
      keyHint: (data?.key_hint as string | undefined) ?? null,
      settings,
    };
  },
});

export const connectNoor = defineAction({
  name: "connectNoor",
  description: "Noor'ni ulaydi: X-Auth token (shifrlanadi) va olib ketish manzili. Token oldin sinab ko'riladi.",
  input: z.object({ settings: z.record(z.unknown()), token: z.string().trim().max(500).default("") }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    if (!isEncryptionConfigured()) throw new ActionError("internal", "Server shifrlash kaliti sozlanmagan");
    const parsed = noorSettingsSchema.safeParse(input.settings);
    if (!parsed.success) throw new ActionError("validation", parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri");
    const db = createAdminClient();
    const { data: existing } = await db.from("integrations").select("credentials_encrypted, key_hint").eq("workspace_id", ctx.workspaceId).eq("provider", "noor").maybeSingle();
    let token = input.token;
    if (!token && existing) token = (JSON.parse(decryptSecret(existing.credentials_encrypted as string)) as { token: string }).token;
    if (!token) throw new ActionError("validation", "Noor tokenini kiriting");
    await wrap(() => testNoor(parsed.data.env, token));
    const { error } = await db.from("integrations").upsert(
      {
        workspace_id: ctx.workspaceId,
        provider: "noor",
        status: "active",
        settings: parsed.data,
        last_error: null,
        created_by: ctx.user.id,
        credentials_encrypted: input.token ? encryptCreds({ token: input.token }) : existing!.credentials_encrypted,
        key_hint: input.token ? keyHint(input.token) : existing!.key_hint,
      },
      { onConflict: "workspace_id,provider" },
    );
    if (error) {
      if (/provider_check/.test(error.message)) throw new ActionError("internal", "Bazaga Noor hali qo'shilmagan (migratsiya kerak). Administratorga murojaat qiling.");
      throw new ActionError("internal", "Saqlanmadi");
    }
    await logAudit(ctx, "integration.connect", { type: "integration", id: "noor" });
    return { ok: true };
  },
});

export const noorQuote = defineAction({
  name: "noorQuote",
  description: "Buyurtma uchun Noor kuryer narxini hisoblaydi (kuryer chaqirilmaydi).",
  input: orderInput.extend({ cod: z.boolean().default(false) }),
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    return wrap(() => noorEstimate(createAdminClient(), ctx.workspaceId, input.orderId, input.cod));
  },
});

export const noorSend = defineAction({
  name: "noorSend",
  description: "Buyurtmaga Noor kuryerini chaqiradi (pullik xizmat). Kuzatish havolasi mijozga yuboriladi.",
  input: orderInput.extend({ cod: z.boolean().default(false) }),
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    const r = await wrap(() => noorCreate(createAdminClient(), ctx.workspaceId, input.orderId, input.cod));
    await logAudit(ctx, "delivery.noor.create", { type: "order", id: input.orderId });
    return r;
  },
});

export const noorTrack = defineAction({
  name: "noorTrack",
  description: "Noor kuryer holatini yangilaydi.",
  input: orderInput,
  handler: async (ctx, input) => wrap(() => noorRefresh(createAdminClient(), ctx.workspaceId, input.orderId)),
});

export const noorCancelOrder = defineAction({
  name: "noorCancelOrder",
  description: "Noor kuryer chaqiruvini bekor qiladi (kuryer olib ketmasdan oldin).",
  input: orderInput,
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    await wrap(() => noorCancel(createAdminClient(), ctx.workspaceId, input.orderId));
    await logAudit(ctx, "delivery.noor.cancel", { type: "order", id: input.orderId });
    return { ok: true };
  },
});

// ===== Fargo (viloyatlararo) =====

export type FargoSetup = { connected: boolean; complete: boolean; keyHint: string | null; settings: Partial<FargoSettings> | null };

export const getFargoSetup = defineAction({
  name: "getFargoSetup",
  description: "Fargo (viloyatlararo yetkazish) ulanish holati va jo'natuvchi sozlamalari.",
  input: z.object({}),
  handler: async (ctx): Promise<FargoSetup> => {
    const { data } = await ctx.supabase.from("integrations").select("status, key_hint, settings").eq("workspace_id", ctx.workspaceId).eq("provider", "fargo").maybeSingle();
    const settings = (data?.settings as Partial<FargoSettings> | undefined) ?? null;
    return {
      connected: !!data,
      complete: !!data && data.status === "active" && fargoSettingsSchema.safeParse(settings).success,
      keyHint: (data?.key_hint as string | undefined) ?? null,
      settings,
    };
  },
});

export const connectFargo = defineAction({
  name: "connectFargo",
  description: "Fargo server manzili va kirish ma'lumotlarini (telefon+parol yoki token, shifrlanadi) saqlaydi; kirib ko'rib tekshiradi.",
  input: z.object({
    baseUrl: z.string().trim().max(200),
    phone: z.string().trim().max(30).default(""),
    password: z.string().max(200).default(""),
    token: z.string().trim().max(500).default(""),
  }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    if (!isEncryptionConfigured()) throw new ActionError("internal", "Server shifrlash kaliti sozlanmagan");
    const base = fargoSettingsSchema.shape.baseUrl.safeParse(input.baseUrl);
    if (!base.success) throw new ActionError("validation", base.error.issues[0]?.message ?? "Server manzili noto'g'ri");
    const db = createAdminClient();
    const { data: existing } = await db.from("integrations").select("credentials_encrypted, key_hint, settings").eq("workspace_id", ctx.workspaceId).eq("provider", "fargo").maybeSingle();
    let creds: FargoCreds = {};
    if (input.token) creds = { token: input.token };
    else if (input.phone && input.password) creds = { phone: input.phone, password: input.password };
    else if (existing) creds = JSON.parse(decryptSecret(existing.credentials_encrypted as string)) as FargoCreds;
    if (!creds.token && !(creds.phone && creds.password)) throw new ActionError("validation", "Telefon va parolni (yoki tokenni) kiriting");
    await wrap(() => testFargo({ baseUrl: base.data, ...creds }));
    const settings = { ...((existing?.settings as Record<string, unknown> | null) ?? {}), baseUrl: base.data };
    const complete = fargoSettingsSchema.safeParse(settings).success;
    const changed = !!(input.token || (input.phone && input.password));
    const { error } = await db.from("integrations").upsert(
      {
        workspace_id: ctx.workspaceId,
        provider: "fargo",
        status: complete ? "active" : "error",
        settings,
        last_error: complete ? null : "Jo'natuvchi ma'lumotlari to'ldirilmagan",
        created_by: ctx.user.id,
        credentials_encrypted: changed || !existing ? encryptCreds(creds) : existing.credentials_encrypted,
        key_hint: changed || !existing ? keyHint(creds.phone ?? creds.token ?? "") : existing.key_hint,
      },
      { onConflict: "workspace_id,provider" },
    );
    if (error) throw new ActionError("internal", "Saqlanmadi");
    await logAudit(ctx, "integration.connect", { type: "integration", id: "fargo" });
    return { ok: true };
  },
});

export const saveFargoSettings = defineAction({
  name: "saveFargoSettings",
  description: "Fargo jo'natuvchi ma'lumotlari: ism, telefon, manzil, shahar, tuman, olib ketish usuli, tezlik, standart og'irlik.",
  input: z.object({ settings: z.record(z.unknown()) }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    const db = createAdminClient();
    const { data: existing } = await db.from("integrations").select("settings").eq("workspace_id", ctx.workspaceId).eq("provider", "fargo").maybeSingle();
    if (!existing) throw new ActionError("validation", "Avval Fargo kirish ma'lumotlarini saqlang");
    const parsed = fargoSettingsSchema.safeParse({ ...input.settings, baseUrl: (existing.settings as { baseUrl?: string } | null)?.baseUrl ?? "" });
    if (!parsed.success) throw new ActionError("validation", parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri");
    await db.from("integrations").update({ settings: parsed.data, status: "active", last_error: null }).eq("workspace_id", ctx.workspaceId).eq("provider", "fargo");
    return { ok: true };
  },
});

export const fargoDirectory = defineAction({
  name: "fargoDirectory",
  description: "Fargo shaharlar ro'yxati yoki (city berilsa) tumanlar ro'yxati.",
  input: z.object({ city: z.string().max(60).optional() }),
  handler: async (ctx, input) => {
    const auth = await loadFargoAuth(createAdminClient(), ctx.workspaceId);
    if (!auth) throw new ActionError("validation", "Avval Fargo kirish ma'lumotlarini saqlang");
    return wrap(async () => (input.city ? await fargoDistricts(auth, input.city) : await fargoCities(auth)));
  },
});

const fargoDest = z.object({
  city: z.string().min(2).max(60),
  district: z.string().max(80).default(""),
  toDoor: z.boolean().default(true),
  weight: z.number().min(0.1).max(100).optional(),
});

export const fargoEstimate = defineAction({
  name: "fargoEstimate",
  description: "Fargo orqali viloyatga yuborish narxini hisoblaydi.",
  input: fargoDest,
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    return wrap(() => fargoQuote(createAdminClient(), ctx.workspaceId, input));
  },
});

export const fargoSend = defineAction({
  name: "fargoSend",
  description: "Buyurtmani Fargo'ga jo'natish uchun yaratadi va faollashtiradi (pullik xizmat). Trek raqami mijozga yuboriladi.",
  input: orderInput.merge(fargoDest).extend({ cod: z.boolean().default(false) }),
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    const r = await wrap(() => fargoCreate(createAdminClient(), ctx.workspaceId, input.orderId, input));
    await logAudit(ctx, "delivery.fargo.create", { type: "order", id: input.orderId });
    return r;
  },
});

export const fargoTrack = defineAction({
  name: "fargoTrack",
  description: "Fargo jo'natma holatini yangilaydi.",
  input: orderInput,
  handler: async (ctx, input) => wrap(() => fargoRefresh(createAdminClient(), ctx.workspaceId, input.orderId)),
});

export const fargoCancelOrder = defineAction({
  name: "fargoCancelOrder",
  description: "Fargo jo'natmasini bekor qiladi (faqat olib ketilmasdan oldin).",
  input: orderInput,
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    await wrap(() => fargoCancel(createAdminClient(), ctx.workspaceId, input.orderId));
    await logAudit(ctx, "delivery.fargo.cancel", { type: "order", id: input.orderId });
    return { ok: true };
  },
});
