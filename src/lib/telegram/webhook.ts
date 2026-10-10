import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";
import { getSiteUrl } from "@/lib/supabase/env";
import { tg } from "./api";

/** Bot qabul qiladigan Telegram yangilanishlari (callback_query — buyurtma tugmalari, channel_post — to'lov kanali) */
export const ALLOWED_UPDATES = ["message", "callback_query", "channel_post"];

/** Eski ro'yxat bilan ulangan botlarning webhook'ini yangilaydi (manzil va kalit o'zgarmaydi) */
export async function ensureWebhookUpdates(token: string, projectId: string, secret: string) {
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

/** Workspace'dagi barcha botlar uchun */
export async function ensureWorkspaceWebhooks(db: SupabaseClient, workspaceId: string) {
  const { data } = await db.from("bots").select("project_id, token_encrypted, webhook_secret").eq("workspace_id", workspaceId);
  for (const b of data ?? []) {
    try {
      await ensureWebhookUpdates(decryptSecret(b.token_encrypted as string), b.project_id as string, b.webhook_secret as string);
    } catch {
      // keyingi safar
    }
  }
}
