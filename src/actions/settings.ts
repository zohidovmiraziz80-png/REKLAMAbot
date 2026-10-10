import { z } from "zod";
import { normalizeUzPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMyWorkspaces, type WorkspaceRole } from "@/lib/workspace";
import { ActionError, defineAction } from "./define";
import { logAudit } from "./audit";

export type Member = { userId: string; email: string; name: string | null; role: WorkspaceRole; you: boolean };
export type SettingsData = {
  workspace: { id: string; name: string; role: WorkspaceRole };
  profile: { email: string; fullName: string; phone: string };
  members: Member[];
  workspaces: { id: string; name: string; role: WorkspaceRole }[];
};

export const getSettings = defineAction({
  name: "getSettings",
  description: "Workspace, profil va xodimlar (a'zolar) ma'lumotlari.",
  input: z.object({}),
  handler: async (ctx): Promise<SettingsData> => {
    const db = createAdminClient();
    const [{ data: ws }, { data: profile }, { data: rows }, workspaces] = await Promise.all([
      ctx.supabase.from("workspaces").select("id, name").eq("id", ctx.workspaceId).single(),
      ctx.supabase.from("profiles").select("full_name, phone").eq("id", ctx.user.id).maybeSingle(),
      db.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", ctx.workspaceId).order("created_at"),
      listMyWorkspaces(ctx.supabase, ctx.user.id),
    ]);
    const ids = (rows ?? []).map((r) => r.user_id as string);
    const [{ data: profiles }, users] = await Promise.all([
      ids.length ? db.from("profiles").select("id, full_name").in("id", ids) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      Promise.all(ids.map((id) => db.auth.admin.getUserById(id).then((r) => [id, r.data.user?.email ?? ""] as const))),
    ]);
    const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]));
    const emails = new Map(users);
    return {
      workspace: { id: ctx.workspaceId, name: (ws?.name as string) ?? "", role: ctx.role },
      profile: { email: ctx.user.email ?? "", fullName: (profile?.full_name as string | null) ?? "", phone: (profile?.phone as string | null) ?? "" },
      members: (rows ?? []).map((r) => ({
        userId: r.user_id as string,
        email: emails.get(r.user_id as string) ?? "",
        name: names.get(r.user_id as string) ?? null,
        role: r.role as WorkspaceRole,
        you: r.user_id === ctx.user.id,
      })),
      workspaces,
    };
  },
});

export const renameWorkspace = defineAction({
  name: "renameWorkspace",
  description: "Workspace (do'kon) nomini o'zgartiradi.",
  input: z.object({ name: z.string().trim().min(2, "Nom kamida 2 harf").max(80) }),
  minRole: "owner",
  handler: async (ctx, input) => {
    const { error } = await ctx.supabase.from("workspaces").update({ name: input.name }).eq("id", ctx.workspaceId);
    if (error) throw new ActionError("internal", "Saqlanmadi");
    await logAudit(ctx, "workspace.rename", { type: "workspace", id: ctx.workspaceId });
    return { ok: true };
  },
});

export const saveProfile = defineAction({
  name: "saveProfile",
  description: "Foydalanuvchining ismi va telefon raqamini saqlaydi.",
  input: z.object({ fullName: z.string().trim().min(2, "Ismingizni kiriting").max(80), phone: z.string().trim().max(30).default("") }),
  handler: async (ctx, input) => {
    let phone: string | null = null;
    if (input.phone.replace(/\D/g, "").length > 3) {
      phone = normalizeUzPhone(input.phone);
      if (!phone) throw new ActionError("validation", "Telefon raqami +998 XX XXX XX XX ko'rinishida bo'lsin");
    }
    const { error } = await ctx.supabase.from("profiles").update({ full_name: input.fullName, phone }).eq("id", ctx.user.id);
    if (error) throw new ActionError("internal", "Saqlanmadi");
    // Yon menyudagi ism ham yangilansin
    await ctx.supabase.auth.updateUser({ data: { full_name: input.fullName } });
    return { ok: true };
  },
});

export const changePassword = defineAction({
  name: "changePassword",
  description: "Foydalanuvchi o'z parolini o'zgartiradi.",
  input: z.object({ password: z.string().min(8, "Parol kamida 8 belgi").max(72) }),
  handler: async (ctx, input) => {
    const { error } = await ctx.supabase.auth.updateUser({ password: input.password });
    if (error) throw new ActionError("validation", error.message.includes("different") ? "Yangi parol eskisidan farq qilishi kerak" : "Parol o'zgartirilmadi");
    return { ok: true };
  },
});

async function findUserByEmail(email: string) {
  const db = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 500 });
    if (error) break;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 500) break;
  }
  return null;
}

export const addMember = defineAction({
  name: "addMember",
  description: "MIXBOT'da ro'yxatdan o'tgan foydalanuvchini email orqali xodim sifatida qo'shadi.",
  input: z.object({ email: z.string().trim().toLowerCase().email("Email noto'g'ri"), role: z.enum(["admin", "member"]).default("member") }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const user = await findUserByEmail(input.email);
    if (!user) throw new ActionError("not_found", "Bu email bilan MIXBOT'da hisob topilmadi. Xodim avval platforma-ebon.vercel.app'da ro'yxatdan o'tsin, keyin qo'shing.");
    const db = createAdminClient();
    const { data: exists } = await db.from("workspace_members").select("user_id").eq("workspace_id", ctx.workspaceId).eq("user_id", user.id).maybeSingle();
    if (exists) throw new ActionError("validation", "Bu foydalanuvchi allaqachon xodim");
    const { error } = await db.from("workspace_members").insert({ workspace_id: ctx.workspaceId, user_id: user.id, role: input.role });
    if (error) throw new ActionError("internal", "Qo'shilmadi");
    await logAudit(ctx, "member.add", { type: "user", id: user.id });
    return { ok: true };
  },
});

export const updateMemberRole = defineAction({
  name: "updateMemberRole",
  description: "Xodim rolini o'zgartiradi (admin yoki xodim).",
  input: z.object({ userId: z.string().uuid(), role: z.enum(["admin", "member"]) }),
  minRole: "owner",
  handler: async (ctx, input) => {
    if (input.userId === ctx.user.id) throw new ActionError("validation", "O'z rolingizni o'zgartira olmaysiz");
    const db = createAdminClient();
    const { data: m } = await db.from("workspace_members").select("role").eq("workspace_id", ctx.workspaceId).eq("user_id", input.userId).maybeSingle();
    if (!m) throw new ActionError("not_found", "Xodim topilmadi");
    if (m.role === "owner") throw new ActionError("forbidden", "Egasining rolini o'zgartirib bo'lmaydi");
    await db.from("workspace_members").update({ role: input.role }).eq("workspace_id", ctx.workspaceId).eq("user_id", input.userId);
    return { ok: true };
  },
});

export const removeMember = defineAction({
  name: "removeMember",
  description: "Xodimni workspace'dan chiqaradi.",
  input: z.object({ userId: z.string().uuid() }),
  minRole: "admin",
  requiresConfirmation: true,
  handler: async (ctx, input) => {
    if (input.userId === ctx.user.id) throw new ActionError("validation", "O'zingizni chiqara olmaysiz");
    const db = createAdminClient();
    const { data: m } = await db.from("workspace_members").select("role").eq("workspace_id", ctx.workspaceId).eq("user_id", input.userId).maybeSingle();
    if (!m) throw new ActionError("not_found", "Xodim topilmadi");
    if (m.role === "owner") throw new ActionError("forbidden", "Egasini chiqarib bo'lmaydi");
    if (m.role === "admin" && ctx.role !== "owner") throw new ActionError("forbidden", "Adminni faqat egasi chiqara oladi");
    await db.from("workspace_members").delete().eq("workspace_id", ctx.workspaceId).eq("user_id", input.userId);
    await logAudit(ctx, "member.remove", { type: "user", id: input.userId });
    return { ok: true };
  },
});
