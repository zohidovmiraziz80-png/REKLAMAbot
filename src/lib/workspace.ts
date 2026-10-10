import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type WorkspaceRole = "owner" | "admin" | "member";

export type ActiveWorkspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

/** Tanlangan workspace saqlanadigan cookie (xodim bir nechta do'konga a'zo bo'lishi mumkin) */
export const WORKSPACE_COOKIE = "mx-ws";

type Row = { role: string; workspaces: { id: string; name: string } | { id: string; name: string }[] | null };

function toWs(r: Row): ActiveWorkspace | null {
  const ws = Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces;
  return ws ? { id: ws.id, name: ws.name, role: r.role as WorkspaceRole } : null;
}

/** Foydalanuvchi a'zo bo'lgan barcha workspace'lar */
export async function listMyWorkspaces(supabase: SupabaseClient, userId: string): Promise<ActiveWorkspace[]> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces ( id, name )")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as unknown as Row[]).map(toWs).filter((w): w is ActiveWorkspace => !!w);
}

/**
 * Foydalanuvchining joriy workspace'i: cookie'da tanlangani (a'zo bo'lsa), bo'lmasa birinchisi (shaxsiy).
 */
export async function getActiveWorkspace(supabase: SupabaseClient, userId: string): Promise<ActiveWorkspace | null> {
  let preferred: string | undefined;
  try {
    preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  } catch {
    // so'rovdan tashqarida cookie yo'q
  }
  const all = await listMyWorkspaces(supabase, userId);
  return (preferred && all.find((w) => w.id === preferred)) || all[0] || null;
}
