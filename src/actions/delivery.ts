import { z } from "zod";
import { decryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { YandexError, checkPrice, yandexSettingsSchema, type YandexSettings } from "@/lib/delivery/yandex";
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
