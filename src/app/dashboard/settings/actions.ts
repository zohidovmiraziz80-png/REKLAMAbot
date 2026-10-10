"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { addMember, changePassword, removeMember, renameWorkspace, saveProfile, updateMemberRole } from "@/actions/settings";
import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE, listMyWorkspaces } from "@/lib/workspace";

const refresh = () => revalidatePath("/dashboard", "layout");

export async function renameWorkspaceAction(name: string) {
  const r = await runAction(renameWorkspace, { name });
  if (r.ok) refresh();
  return r;
}

export async function saveProfileAction(input: { fullName: string; phone: string }) {
  const r = await runAction(saveProfile, input);
  if (r.ok) refresh();
  return r;
}

export async function changePasswordAction(password: string) {
  return runAction(changePassword, { password });
}

export async function addMemberAction(input: { email: string; role: "admin" | "member" }) {
  const r = await runAction(addMember, input);
  if (r.ok) revalidatePath("/dashboard/settings");
  return r;
}

export async function updateMemberRoleAction(input: { userId: string; role: "admin" | "member" }) {
  const r = await runAction(updateMemberRole, input);
  if (r.ok) revalidatePath("/dashboard/settings");
  return r;
}

export async function removeMemberAction(userId: string) {
  // Foydalanuvchi tasdiqlash oynasini bosgandan keyin
  const r = await runAction(removeMember, { userId }, { confirmed: true });
  if (r.ok) revalidatePath("/dashboard/settings");
  return r;
}

/** Boshqa do'konga (workspace) o'tish — faqat a'zo bo'lganlariga */
export async function switchWorkspaceAction(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Avval tizimga kiring" };
  const all = await listMyWorkspaces(supabase, user.id);
  if (!all.some((w) => w.id === workspaceId)) return { ok: false as const, error: "Bu do'konga a'zo emassiz" };
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365 });
  refresh();
  return { ok: true as const };
}
