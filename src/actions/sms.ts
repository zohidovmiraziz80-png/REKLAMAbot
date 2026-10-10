import { z } from "zod";
import { decryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { encryptCreds, keyHint } from "@/lib/integrations/store";
import { EskizError, eskizSettingsSchema, sendSms, testEskizLogin, type EskizSettings } from "@/lib/sms/eskiz";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, defineAction } from "./define";
import { logAudit } from "./audit";
import { requireFeature } from "./plan-guard";

export type EskizSetup = { connected: boolean; status: string | null; settings: Partial<EskizSettings> | null };

export const getEskizSetup = defineAction({
  name: "getEskizSetup",
  description: "Eskiz SMS ulanish holati va sozlamalari.",
  input: z.object({}),
  handler: async (ctx): Promise<EskizSetup> => {
    const { data } = await ctx.supabase.from("integrations").select("status, settings").eq("workspace_id", ctx.workspaceId).eq("provider", "eskiz").maybeSingle();
    return { connected: !!data, status: (data?.status as string | undefined) ?? null, settings: (data?.settings as Partial<EskizSettings> | undefined) ?? null };
  },
});

async function existingPassword(workspaceId: string) {
  const { data } = await createAdminClient().from("integrations").select("credentials_encrypted").eq("workspace_id", workspaceId).eq("provider", "eskiz").maybeSingle();
  if (!data) return null;
  try {
    return (JSON.parse(decryptSecret(data.credentials_encrypted as string)) as { password?: string }).password ?? null;
  } catch {
    return null;
  }
}

export const connectEskiz = defineAction({
  name: "connectEskiz",
  description: "Eskiz SMS'ni ulaydi (email va parol — parol shifrlanadi) va SMS shablonlarini saqlaydi.",
  input: z.object({ settings: z.record(z.unknown()), password: z.string().max(200).default("") }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    if (!isEncryptionConfigured()) throw new ActionError("internal", "Server shifrlash kaliti sozlanmagan");
    const parsed = eskizSettingsSchema.safeParse(input.settings);
    if (!parsed.success) throw new ActionError("validation", parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri");
    const password = input.password || (await existingPassword(ctx.workspaceId));
    if (!password) throw new ActionError("validation", "Eskiz parolini kiriting");
    try {
      await testEskizLogin(parsed.data.email, password);
    } catch (err) {
      throw new ActionError("validation", err instanceof EskizError ? err.message : "Eskiz tekshiruvidan o'tmadi");
    }
    const { error } = await createAdminClient()
      .from("integrations")
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          provider: "eskiz",
          status: "active",
          settings: parsed.data,
          last_error: null,
          created_by: ctx.user.id,
          credentials_encrypted: encryptCreds({ password }),
          key_hint: keyHint(parsed.data.email),
        },
        { onConflict: "workspace_id,provider" },
      );
    if (error) throw new ActionError("internal", "Saqlanmadi");
    await logAudit(ctx, "integration.connect", { type: "integration", id: "eskiz" });
    return { ok: true };
  },
});

export const sendTestSms = defineAction({
  name: "sendTestSms",
  description: "Ko'rsatilgan raqamga Eskiz orqali sinov SMS yuboradi (pullik, bitta SMS).",
  input: z.object({ phone: z.string().max(30) }),
  minRole: "admin",
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    const { data } = await ctx.supabase.from("integrations").select("settings").eq("workspace_id", ctx.workspaceId).eq("provider", "eskiz").maybeSingle();
    const s = eskizSettingsSchema.safeParse(data?.settings);
    const password = await existingPassword(ctx.workspaceId);
    if (!s.success || !password) throw new ActionError("validation", "Avval Eskiz'ni ulang");
    try {
      await sendSms({ email: s.data.email, password, from: s.data.from }, input.phone, "Bu Eskiz dan test");
    } catch (err) {
      throw new ActionError("validation", err instanceof EskizError ? err.message : "SMS yuborilmadi");
    }
    return { ok: true };
  },
});
