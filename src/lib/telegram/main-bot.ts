import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { decryptSecret } from "@/lib/crypto";
import { publicSiteUrls } from "@/lib/site/hosting";
import { botConfigSchema, type BotConfig } from "./config";

/** Do'konning asosiy boti (birinchi ulangan) — kanal, kuryer va eslatmalar shu bot orqali */
export type MainBot = { projectId: string; workspaceId: string; username: string; token: string; ownerChatId: number | null; config: BotConfig; linkCode: string };

/** Kanal/kuryer ulash kodi (egasining maxfiy kodidan hosil qilinadi) */
export function linkCode(ownerLinkCode: string, purpose: string) {
  return createHash("sha256").update(`${purpose}:${ownerLinkCode}`).digest("hex").slice(0, 10);
}

export async function loadMainBot(db: SupabaseClient, workspaceId: string): Promise<MainBot | null> {
  const { data } = await db
    .from("bots")
    .select("project_id, username, token_encrypted, owner_chat_id, owner_link_code, config")
    .eq("workspace_id", workspaceId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  try {
    return {
      projectId: data.project_id as string,
      workspaceId,
      username: data.username as string,
      token: decryptSecret(data.token_encrypted as string),
      ownerChatId: (data.owner_chat_id as number | null) ?? null,
      config: botConfigSchema.parse(data.config ?? {}),
      linkCode: data.owner_link_code as string,
    };
  } catch {
    return null;
  }
}

export async function updateBotConfig(db: SupabaseClient, projectId: string, patch: Partial<BotConfig>) {
  const { data } = await db.from("bots").select("config").eq("project_id", projectId).maybeSingle();
  const cfg = botConfigSchema.parse(data?.config ?? {});
  await db.from("bots").update({ config: { ...cfg, ...patch } }).eq("project_id", projectId);
}

export async function shopUrl(db: SupabaseClient, workspaceId: string, cfg?: BotConfig) {
  const { data } = await db.from("published_sites").select("slug").eq("workspace_id", workspaceId).limit(1).maybeSingle();
  if (data) {
    const u = publicSiteUrls(data.slug as string);
    return u.subdomainUrl ?? u.pathUrl;
  }
  return cfg?.siteUrl || null;
}
