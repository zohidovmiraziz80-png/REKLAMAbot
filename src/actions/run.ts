import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { ActionError, hasRole, type ActionDefinition, type ActionResult } from "./define";

type RunOptions = {
  /** Foydalanuvchi tasdiqladimi (requiresConfirmation: true bo'lgan amallar uchun) */
  confirmed?: boolean;
};

/**
 * Amalni xavfsiz bajaradi: sessiya → workspace → rol → tasdiq → validatsiya → handler.
 * Faqat serverda chaqiriladi (Server Action, Route Handler yoki AI Assistant ichidan).
 */
export async function runAction<Schema extends z.ZodTypeAny, Output>(
  action: ActionDefinition<Schema, Output>,
  rawInput: unknown,
  options: RunOptions = {},
): Promise<ActionResult<Output>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: "unauthenticated", error: "Avval tizimga kiring" };

    const workspace = await getActiveWorkspace(supabase, user.id);
    if (!workspace) return { ok: false, code: "no_workspace", error: "Workspace topilmadi" };

    if (!hasRole(workspace.role, action.minRole)) {
      return { ok: false, code: "forbidden", error: "Bu amal uchun ruxsatingiz yo'q" };
    }

    if (action.requiresConfirmation && !options.confirmed) {
      return { ok: false, code: "confirmation_required", error: "Bu amal tasdiqlashni talab qiladi" };
    }

    const parsed = action.input.safeParse(rawInput);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return {
        ok: false,
        code: "validation",
        error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? "Ma'lumot noto'g'ri",
        fieldErrors: flat.fieldErrors as Record<string, string[]>,
      };
    }

    const data = await action.handler(
      { user, workspaceId: workspace.id, role: workspace.role, supabase },
      parsed.data,
    );
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, code: err.code, error: err.message };
    console.error(`Amal xatosi (${action.name}):`, err);
    return { ok: false, code: "internal", error: "Kutilmagan xato yuz berdi" };
  }
}
