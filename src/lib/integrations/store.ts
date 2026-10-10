import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * Integratsiya kalitlari va sozlamalarini saqlash. Faqat serverda, service role klienti bilan.
 */

export type Provider = "bito" | "payme" | "click" | "multicard" | "yandex" | "bts" | "fargo" | "eskiz" | "amocrm" | "bitrix24";

export const bitoSettingsSchema = z.object({
  organizationId: z.string().max(64).catch(""),
  priceId: z.string().max(64).catch(""),
  warehouseId: z.string().max(64).catch(""),
  responsibleId: z.string().max(64).catch(""),
  syncProducts: z.boolean().catch(true),
  sendOrders: z.boolean().catch(true),
  onlyInStock: z.boolean().catch(true),
  orderState: z.enum(["new", "draft", "in_progress"]).catch("new"),
  /** Bito rasmlari joylashgan manzil (avtomatik aniqlanadi) */
  imageHost: z.string().max(100).nullable().catch(null),
});
export type BitoSettings = z.output<typeof bitoSettingsSchema>;

export type IntegrationRow<S> = {
  workspaceId: string;
  provider: Provider;
  status: "active" | "error" | "disabled";
  creds: Record<string, string>;
  settings: S;
  lastSyncAt: string | null;
  syncStartedAt: string | null;
};

export async function loadIntegration(db: SupabaseClient, workspaceId: string, provider: "bito"): Promise<IntegrationRow<BitoSettings> | null> {
  const { data } = await db
    .from("integrations")
    .select("workspace_id, provider, status, credentials_encrypted, settings, last_sync_at, sync_started_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data) return null;
  let creds: Record<string, string> = {};
  try {
    creds = JSON.parse(decryptSecret(data.credentials_encrypted as string)) as Record<string, string>;
  } catch {
    return null;
  }
  return {
    workspaceId,
    provider,
    status: data.status as IntegrationRow<BitoSettings>["status"],
    creds,
    settings: bitoSettingsSchema.parse(data.settings ?? {}),
    lastSyncAt: (data.last_sync_at as string | null) ?? null,
    syncStartedAt: (data.sync_started_at as string | null) ?? null,
  };
}

export function encryptCreds(creds: Record<string, string>) {
  return encryptSecret(JSON.stringify(creds));
}

export function keyHint(secret: string) {
  return `…${secret.slice(-4)}`;
}
