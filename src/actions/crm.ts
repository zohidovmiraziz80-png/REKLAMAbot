import { z } from "zod";
import { decryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { CrmError, amoSettingsSchema, bitrixSettingsSchema, normalizeBitrixUrl, testAmo, testBitrix, type CrmProvider } from "@/lib/integrations/crm";
import { encryptCreds, keyHint } from "@/lib/integrations/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, defineAction } from "./define";
import { logAudit } from "./audit";
import { requireFeature } from "./plan-guard";

export type CrmSetup = { provider: CrmProvider; connected: boolean; status: string | null; keyHint: string | null; settings: Record<string, unknown> | null; lastError: string | null; lastSyncAt: string | null };

const provider = z.enum(["bitrix24", "amocrm"]);

export const getCrmSetup = defineAction({
  name: "getCrmSetup",
  description: "AmoCRM yoki Bitrix24 ulanish holati.",
  input: z.object({ provider }),
  handler: async (ctx, input): Promise<CrmSetup> => {
    const { data } = await ctx.supabase
      .from("integrations")
      .select("status, key_hint, settings, last_error, last_sync_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", input.provider)
      .maybeSingle();
    return {
      provider: input.provider,
      connected: !!data,
      status: (data?.status as string | undefined) ?? null,
      keyHint: (data?.key_hint as string | undefined) ?? null,
      settings: (data?.settings as Record<string, unknown> | undefined) ?? null,
      lastError: (data?.last_error as string | null | undefined) ?? null,
      lastSyncAt: (data?.last_sync_at as string | null | undefined) ?? null,
    };
  },
});

export const connectCrm = defineAction({
  name: "connectCrm",
  description: "AmoCRM (subdomen + uzoq muddatli token) yoki Bitrix24 (kiruvchi webhook) ni ulaydi — yangi buyurtmalar CRM'ga tushadi.",
  input: z.object({ provider, settings: z.record(z.unknown()), secret: z.string().trim().max(1500).default("") }),
  minRole: "admin",
  handler: async (ctx, input) => {
    await requireFeature(ctx, "integrations");
    if (!isEncryptionConfigured()) throw new ActionError("internal", "Server shifrlash kaliti sozlanmagan");
    const db = createAdminClient();
    const { data: existing } = await db.from("integrations").select("credentials_encrypted").eq("workspace_id", ctx.workspaceId).eq("provider", input.provider).maybeSingle();
    let old: { url?: string; token?: string } = {};
    if (existing) {
      try {
        old = JSON.parse(decryptSecret(existing.credentials_encrypted as string));
      } catch {
        old = {};
      }
    }
    let settings: Record<string, unknown>;
    let creds: Record<string, string>;
    let hint: string;
    try {
      if (input.provider === "bitrix24") {
        const s = bitrixSettingsSchema.safeParse(input.settings);
        if (!s.success) throw new ActionError("validation", "Sozlama noto'g'ri");
        const url = input.secret ? normalizeBitrixUrl(input.secret) : old.url;
        if (!url) throw new ActionError("validation", "Webhook manzilini kiriting");
        await testBitrix(url);
        settings = s.data;
        creds = { url };
        hint = new URL(url).hostname;
      } else {
        const s = amoSettingsSchema.safeParse(input.settings);
        if (!s.success) throw new ActionError("validation", s.error.issues[0]?.message ?? "Sozlama noto'g'ri");
        const token = input.secret || old.token;
        if (!token) throw new ActionError("validation", "Tokenni kiriting");
        await testAmo(s.data.subdomain, token);
        settings = s.data;
        creds = { token };
        hint = keyHint(token);
      }
    } catch (err) {
      if (err instanceof CrmError) throw new ActionError("validation", err.message);
      throw err;
    }
    const { error } = await db.from("integrations").upsert(
      {
        workspace_id: ctx.workspaceId,
        provider: input.provider,
        status: "active",
        settings,
        last_error: null,
        created_by: ctx.user.id,
        credentials_encrypted: encryptCreds(creds),
        key_hint: hint,
      },
      { onConflict: "workspace_id,provider" },
    );
    if (error) throw new ActionError("internal", "Saqlanmadi");
    await logAudit(ctx, "integration.connect", { type: "integration", id: input.provider });
    return { ok: true };
  },
});
