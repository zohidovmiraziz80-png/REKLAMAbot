import type { SupabaseClient } from "@supabase/supabase-js";

export async function siteBySlug(db: SupabaseClient, slug: string) {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const { data } = await db.from("published_sites").select("project_id, workspace_id").eq("slug", slug).maybeSingle();
  return data ? { projectId: data.project_id as string, workspaceId: data.workspace_id as string } : null;
}

export const SESSION_HEADER = "x-mx-session";
