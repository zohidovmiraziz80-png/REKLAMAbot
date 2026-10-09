import type { ActionContext } from "./define";

/** Muhim amalni audit_logs jadvaliga yozadi. Xato bo'lsa amalni to'xtatmaydi. */
export async function logAudit(
  ctx: ActionContext,
  action: string,
  target?: { type: string; id: string },
  meta: Record<string, unknown> = {},
) {
  const { error } = await ctx.supabase.from("audit_logs").insert({
    workspace_id: ctx.workspaceId,
    user_id: ctx.user.id,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    meta,
  });
  if (error) console.error("audit_logs yozilmadi:", action, error.message);
}
