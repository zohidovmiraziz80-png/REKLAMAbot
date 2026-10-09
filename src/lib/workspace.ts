import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceRole = "owner" | "admin" | "member";

export type ActiveWorkspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

/**
 * Foydalanuvchining joriy workspace'ini qaytaradi.
 * Hozircha birinchi (shaxsiy) workspace olinadi; keyin workspace almashtirish qo'shiladi.
 */
export async function getActiveWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveWorkspace | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces ( id, name )")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const ws = (Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces) as
    | { id: string; name: string }
    | null
    | undefined;
  if (!ws) return null;

  return { id: ws.id, name: ws.name, role: data.role as WorkspaceRole };
}
