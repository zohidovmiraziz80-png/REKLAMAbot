import { z } from "zod";
import { ActionError, defineAction } from "./define";
import { logAudit } from "./audit";
import { PROJECT_TYPES, type Project } from "./project-types";

export { PROJECT_TYPES, type Project, type ProjectType } from "./project-types";

const projectName = z
  .string()
  .trim()
  .min(1, "Nom kiritilmagan")
  .max(100, "Nom 100 belgidan oshmasligi kerak");

export const createProject = defineAction({
  name: "createProject",
  description: "Joriy workspace'da yangi loyiha (sayt, Telegram bot yoki avtomatlashtirish) yaratadi",
  input: z.object({
    name: projectName,
    type: z.enum(PROJECT_TYPES),
  }),
  handler: async (ctx, input): Promise<Project> => {
    const { data, error } = await ctx.supabase
      .from("projects")
      .insert({
        workspace_id: ctx.workspaceId,
        name: input.name,
        type: input.type,
        created_by: ctx.user.id,
      })
      .select("id, name, type, created_at, updated_at")
      .single();

    if (error || !data) throw new ActionError("internal", "Loyiha yaratilmadi");
    await logAudit(ctx, "project.create", { type: "project", id: data.id }, { name: input.name, type: input.type });
    return data as Project;
  },
});

export const listProjects = defineAction({
  name: "listProjects",
  description: "Joriy workspace'dagi loyihalar ro'yxatini qaytaradi; turi bo'yicha filtrlash mumkin",
  input: z.object({
    type: z.enum(PROJECT_TYPES).optional(),
  }),
  handler: async (ctx, input): Promise<Project[]> => {
    let query = ctx.supabase
      .from("projects")
      .select("id, name, type, created_at, updated_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false });

    if (input.type) query = query.eq("type", input.type);

    const { data, error } = await query;
    if (error) throw new ActionError("internal", "Loyihalar yuklanmadi");
    return (data ?? []) as Project[];
  },
});

export const renameProject = defineAction({
  name: "renameProject",
  description: "Loyiha nomini o'zgartiradi",
  input: z.object({
    id: z.string().uuid(),
    name: projectName,
  }),
  handler: async (ctx, input): Promise<Project> => {
    const { data, error } = await ctx.supabase
      .from("projects")
      .update({ name: input.name })
      .eq("id", input.id)
      .eq("workspace_id", ctx.workspaceId)
      .select("id, name, type, created_at, updated_at")
      .maybeSingle();

    if (error) throw new ActionError("internal", "Nom o'zgartirilmadi");
    if (!data) throw new ActionError("not_found", "Loyiha topilmadi");
    await logAudit(ctx, "project.rename", { type: "project", id: input.id }, { name: input.name });
    return data as Project;
  },
});

export const deleteProject = defineAction({
  name: "deleteProject",
  description: "Loyihani butunlay o'chiradi. Qaytarib bo'lmaydi",
  requiresConfirmation: true,
  minRole: "admin",
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (ctx, input): Promise<{ id: string }> => {
    const { data, error } = await ctx.supabase
      .from("projects")
      .delete()
      .eq("id", input.id)
      .eq("workspace_id", ctx.workspaceId)
      .select("id, name")
      .maybeSingle();

    if (error) throw new ActionError("internal", "Loyiha o'chirilmadi");
    if (!data) throw new ActionError("not_found", "Loyiha topilmadi");
    await logAudit(ctx, "project.delete", { type: "project", id: input.id }, { name: data.name });
    return { id: input.id };
  },
});
