import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { z } from "zod";
import type { WorkspaceRole } from "@/lib/workspace";

/** Har bir amal ishlaydigan kontekst. Interfeys ham, AI Assistant ham shu orqali chaqiradi. */
export type ActionContext = {
  user: User;
  workspaceId: string;
  role: WorkspaceRole;
  supabase: SupabaseClient;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ActionErrorCode; fieldErrors?: Record<string, string[]> };

export type ActionErrorCode =
  | "unauthenticated"
  | "no_workspace"
  | "validation"
  | "forbidden"
  | "confirmation_required"
  | "not_found"
  | "internal";

export class ActionError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type ActionDefinition<Schema extends z.ZodTypeAny, Output> = {
  /** Noyob nom — AI Assistant uchun tool nomi sifatida ishlatiladi */
  name: string;
  /** Amal nima qilishini tushuntiradi — AI shu matnga qarab amalni tanlaydi */
  description: string;
  input: Schema;
  /** Pul, o'chirish yoki tashqi xizmatga yuborish — bajarishdan oldin tasdiq kerak */
  requiresConfirmation?: boolean;
  /** Amalni bajarish uchun eng past rol (standart: member) */
  minRole?: WorkspaceRole;
  handler: (ctx: ActionContext, input: z.infer<Schema>) => Promise<Output>;
};

export function defineAction<Schema extends z.ZodTypeAny, Output>(
  def: ActionDefinition<Schema, Output>,
): ActionDefinition<Schema, Output> {
  return def;
}

const ROLE_RANK: Record<WorkspaceRole, number> = { member: 1, admin: 2, owner: 3 };

export function hasRole(role: WorkspaceRole, minRole: WorkspaceRole = "member") {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
