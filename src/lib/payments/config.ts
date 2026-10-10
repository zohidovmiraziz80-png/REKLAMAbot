import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";

/**
 * To'lov tizimlari sozlamalari (integrations jadvalida saqlanadi).
 * Maxfiy kalitlar credentials_encrypted ichida, ochiq qiymatlar settings ichida.
 */

export type PayProvider = "payme" | "click" | "multicard";
export const PAY_PROVIDERS: PayProvider[] = ["payme", "click", "multicard"];
export const PAY_LABELS: Record<PayProvider, string> = { payme: "Payme", click: "Click", multicard: "Multicard" };

export const paymeSettings = z.object({ merchantId: z.string().trim().regex(/^[a-f0-9]{24}$/i, "Merchant ID 24 belgili bo'ladi"), testMode: z.boolean().default(false) });
export const clickSettings = z.object({
  serviceId: z.string().trim().regex(/^\d{1,12}$/, "Service ID — faqat raqam"),
  merchantId: z.string().trim().regex(/^\d{1,12}$/, "Merchant ID — faqat raqam"),
  merchantUserId: z.string().trim().regex(/^\d{0,12}$/).default(""),
});
export const multicardSettings = z.object({
  storeId: z.string().trim().regex(/^\d{1,12}$/, "Store ID — faqat raqam"),
  applicationId: z.string().trim().min(2).max(100),
  testMode: z.boolean().default(false),
});

export type PaymeConfig = z.infer<typeof paymeSettings> & { key: string };
export type ClickConfig = z.infer<typeof clickSettings> & { secretKey: string };
export type MulticardConfig = z.infer<typeof multicardSettings> & { secret: string };

type Row = { provider: string; status: string; settings: unknown; credentials_encrypted: string };

function creds(row: Row): Record<string, string> {
  try {
    return JSON.parse(decryptSecret(row.credentials_encrypted)) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function loadPayConfigs(db: SupabaseClient, workspaceId: string) {
  const { data } = await db
    .from("integrations")
    .select("provider, status, settings, credentials_encrypted")
    .eq("workspace_id", workspaceId)
    .in("provider", PAY_PROVIDERS);
  const out: { payme?: PaymeConfig; click?: ClickConfig; multicard?: MulticardConfig } = {};
  for (const r of (data ?? []) as Row[]) {
    if (r.status !== "active") continue;
    const c = creds(r);
    if (r.provider === "payme") {
      const s = paymeSettings.safeParse(r.settings);
      if (s.success && c.key) out.payme = { ...s.data, key: c.key };
    } else if (r.provider === "click") {
      const s = clickSettings.safeParse(r.settings);
      if (s.success && c.secretKey) out.click = { ...s.data, secretKey: c.secretKey };
    } else if (r.provider === "multicard") {
      const s = multicardSettings.safeParse(r.settings);
      if (s.success && c.secret) out.multicard = { ...s.data, secret: c.secret };
    }
  }
  return out;
}

/** Saytda ko'rsatiladigan onlayn to'lov usullari (faqat nomlari, kalitsiz) */
export async function enabledPayMethods(db: SupabaseClient, workspaceId: string): Promise<PayProvider[]> {
  const { data } = await db.from("integrations").select("provider").eq("workspace_id", workspaceId).eq("status", "active").in("provider", PAY_PROVIDERS);
  return PAY_PROVIDERS.filter((p) => (data ?? []).some((r) => r.provider === p));
}
